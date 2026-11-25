package co.rutas.seguimiento;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // localStorage: copia local de los registros
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);

        final WebViewAssetLoader cargador = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();

        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return cargador.shouldInterceptRequest(r.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    Intent i = "mailto".equals(u.getScheme()) ? new Intent(Intent.ACTION_SENDTO, u) : new Intent(Intent.ACTION_VIEW, u);
                    startActivity(i);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "No hay una app para abrir este enlace", Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });
        web.addJavascriptInterface(new Puente(), "Android");
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("https://" + HOST + "/assets/index.html");
    }

    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }

    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

    /** Funciones que la página llama como window.Android.* */
    class Puente {
        /** Guarda el CSV en Descargas/SeguimientoRutas. Devuelve la ubicación o "" si falla. */
        @JavascriptInterface
        public String guardarArchivo(String nombre, String contenido) {
            byte[] datos = contenido.getBytes(StandardCharsets.UTF_8);
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, nombre);
                    cv.put(MediaStore.Downloads.MIME_TYPE, "text/csv");
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SeguimientoRutas");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(datos); }
                    return "Descargas/SeguimientoRutas";
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "");
                    dir.mkdirs();
                    try (FileOutputStream fo = new FileOutputStream(new File(dir, nombre))) { fo.write(datos); }
                    return dir.getAbsolutePath();
                }
            } catch (Exception e) {
                return "";
            }
        }

        /** Abre el menú de compartir (correo, WhatsApp, Drive…) con el CSV adjunto. */
        @JavascriptInterface
        public void compartir(String nombre, String contenido) {
            try {
                File dir = new File(getCacheDir(), "csv");
                dir.mkdirs();
                File f = new File(dir, nombre);
                try (FileOutputStream fo = new FileOutputStream(f)) { fo.write(contenido.getBytes(StandardCharsets.UTF_8)); }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, "co.rutas.seguimiento.archivos", f);
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/csv");
                i.putExtra(Intent.EXTRA_STREAM, uri);
                i.putExtra(Intent.EXTRA_SUBJECT, "Registros de rutas");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(Intent.createChooser(i, "Compartir registros"));
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "No se pudo compartir el archivo", Toast.LENGTH_LONG).show());
            }
        }
    }
}

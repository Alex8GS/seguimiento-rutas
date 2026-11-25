/**
 * Seguimiento de Rutas — Google Apps Script
 * Pegue este código en Extensiones > Apps Script de su hoja de Google.
 * Luego: Implementar > Nueva implementación > Aplicación web
 *   Ejecutar como: Yo   |   Quién tiene acceso: Cualquier persona
 */
const CLAVE = 'CAMBIE-ESTA-CLAVE';   // Debe ser igual a la "Clave compartida" de la app
const CORREO_FIJO = '';              // Opcional: si lo llena, los correos van SIEMPRE aquí (ignora el de la app)
const HOJA = 'Registros', HOJA_PLACAS = 'Placas';
const ENC = ['ID','Fecha','Hora','Cédula','Placa','Usó ruta','Cambio','Observaciones','Punto/Operador','Estado','Editado','Recibido'];

function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function hoja(nombre, enc){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh){ sh = ss.insertSheet(nombre); sh.appendRow(enc); sh.setFrozenRows(1); sh.getRange(1,1,1,enc.length).setFontWeight('bold').setBackground('#0b3d91').setFontColor('#ffffff'); }
  return sh;
}

function doGet(e){
  const p = e.parameter || {};
  if (p.token !== CLAVE) return json({ok:false, error:'Clave inválida'});
  if (p.accion === 'placas'){
    const sh = hoja(HOJA_PLACAS, ['Placa']);
    const v = sh.getLastRow() > 1 ? sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().filter(String) : [];
    return json({ok:true, placas:v});
  }
  return json({ok:true, hoja:SpreadsheetApp.getActiveSpreadsheet().getName()});
}

function doPost(e){
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const d = JSON.parse(e.postData.contents);
    if (d.token !== CLAVE) return json({ok:false, error:'Clave inválida'});
    const regs = d.registros || [];
    const sh = hoja(HOJA, ENC);
    const n = sh.getLastRow();
    const ids = n > 1 ? sh.getRange(2,1,n-1,1).getValues().flat().map(String) : [];
    const ahora = new Date();
    regs.forEach(r => {
      // Prefijo ' para que Sheets no convierta cédulas/fechas
      const fila = [r.id, "'"+r.fecha, "'"+r.hora, "'"+r.cedula, r.placa, r.uso, r.cambio, r.obs, r.punto, r.estado, r.editado || '', ahora];
      const i = ids.indexOf(String(r.id));
      if (i >= 0) sh.getRange(i+2,1,1,fila.length).setValues([fila]);   // actualiza (ediciones/anulaciones)
      else { sh.appendRow(fila); ids.push(String(r.id)); }
    });
    let correo = false;
    const dest = CORREO_FIJO || d.correo;
    if (dest && regs.length){
      const filas = regs.map(r => `<tr><td>${r.fecha} ${r.hora}</td><td>${r.cedula}</td><td>${r.placa}</td><td>${r.uso}</td><td>${r.cambio}</td><td>${(r.obs||'').replace(/</g,'&lt;')}</td><td>${r.estado}</td></tr>`).join('');
      MailApp.sendEmail({
        to: dest,
        subject: `Registros de rutas ${regs[0].fecha} — ${d.punto || 'sin punto'} (${regs.length})`,
        htmlBody: `<p>Se recibieron <b>${regs.length}</b> registros desde <b>${d.punto || 'la app'}</b>.</p>
          <table border="1" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
          <tr style="background:#0b3d91;color:#fff"><th>Fecha/hora</th><th>Cédula</th><th>Placa</th><th>Usó ruta</th><th>Cambio</th><th>Observaciones</th><th>Estado</th></tr>${filas}</table>
          <p><a href="${SpreadsheetApp.getActiveSpreadsheet().getUrl()}">Abrir la hoja</a></p>`
      });
      correo = true;
    }
    return json({ok:true, recibidos:regs.length, correo});
  } catch(err){
    return json({ok:false, error:String(err)});
  } finally { lock.releaseLock(); }
}

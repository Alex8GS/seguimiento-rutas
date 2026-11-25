/**
 * Seguimiento de Rutas — Google Apps Script (servidor de la app y del portal)
 * 1. Pegue este código en Extensiones > Apps Script de su hoja de Google.
 * 2. Cambie CLAVE (la usan los teléfonos) y CLAVE_ADMIN (la usa el portal web).
 * 3. Implementar > Nueva implementación > Aplicación web
 *    Ejecutar como: Yo   |   Quién tiene acceso: Cualquier persona
 * Si cambia el código: Implementar > Gestionar implementaciones > Editar > Nueva versión.
 */
const CLAVE = 'CAMBIE-ESTA-CLAVE';
const CLAVE_ADMIN = 'CAMBIE-CLAVE-ADMIN';
const HOJA = 'Registros', HOJA_PLACAS = 'Placas', HOJA_CONFIG = 'Config';
const ENC = ['ID','Fecha','Hora','Cédula','Placa','Usó ruta','Cambio','Observaciones','Punto/Operador','Estado','Editado','Recibido'];
const CAMPOS = ['id','fecha','hora','cedula','placa','uso','cambio','obs','punto','estado','editado','recibido'];

function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function hoja(nombre, enc){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh){ sh = ss.insertSheet(nombre); sh.appendRow(enc); sh.setFrozenRows(1); sh.getRange(1,1,1,enc.length).setFontWeight('bold').setBackground('#0b3d91').setFontColor('#ffffff'); }
  return sh;
}
function leerPlacas(){
  const sh = hoja(HOJA_PLACAS, ['Placa']);
  return sh.getLastRow() > 1 ? sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String).filter(String) : [];
}
function leerConfig(){
  const sh = hoja(HOJA_CONFIG, ['Clave','Valor']);
  const c = {correo:'', aviso:'', activa:'SI'};
  if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,2).getValues().forEach(r => { if (r[0]) c[r[0]] = String(r[1]); });
  return c;
}
function guardarConfig(c){
  const sh = hoja(HOJA_CONFIG, ['Clave','Valor']);
  if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,2).clearContent();
  const filas = ['correo','aviso','activa'].map(k => [k, c[k] || '']);
  sh.getRange(2,1,filas.length,2).setValues(filas);
}
function txt(v){ return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : String(v); }
function leerRegistros(desde, hasta){
  const sh = hoja(HOJA, ENC), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2,1,n-1,ENC.length).getValues().map(f => {
    const o = {}; CAMPOS.forEach((k,i) => o[k] = txt(f[i]).replace(/^'/,'')); return o;
  }).filter(r => (!desde || r.fecha >= desde) && (!hasta || r.fecha <= hasta));
}
function upsert(regs){
  const sh = hoja(HOJA, ENC), n = sh.getLastRow();
  const ids = n > 1 ? sh.getRange(2,1,n-1,1).getValues().flat().map(String) : [];
  const ahora = new Date();
  regs.forEach(r => {
    const fila = [r.id, "'"+r.fecha, "'"+r.hora, "'"+r.cedula, r.placa, r.uso, r.cambio, r.obs || '', r.punto || '', r.estado || 'Activo', r.editado || '', ahora];
    const i = ids.indexOf(String(r.id));
    if (i >= 0) sh.getRange(i+2,1,1,fila.length).setValues([fila]);
    else { sh.appendRow(fila); ids.push(String(r.id)); }
  });
}

function doGet(e){
  const p = e.parameter || {};
  if (p.token !== CLAVE && p.token !== CLAVE_ADMIN) return json({ok:false, error:'Clave inválida'});
  if (p.accion === 'placas') return json({ok:true, placas:leerPlacas()});
  if (p.accion === 'config'){ const c = leerConfig(); return json({ok:true, placas:leerPlacas(), correo:c.correo, aviso:c.aviso, activa:c.activa !== 'NO'}); }
  return json({ok:true, hoja:SpreadsheetApp.getActiveSpreadsheet().getName()});
}

function doPost(e){
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const d = JSON.parse(e.postData.contents);
    const esAdmin = d.token === CLAVE_ADMIN;
    if (d.token !== CLAVE && !esAdmin) return json({ok:false, error:'Clave inválida'});

    // ---- Acciones del portal (solo con CLAVE_ADMIN) ----
    if (d.accion && d.accion !== 'registrar'){
      if (!esAdmin) return json({ok:false, error:'Se requiere la clave de administrador'});
      if (d.accion === 'listar') return json({ok:true, registros:leerRegistros(d.desde, d.hasta), placas:leerPlacas(), config:leerConfig()});
      if (d.accion === 'actualizar'){ upsert([Object.assign(d.registro, {editado:'Portal ' + txt(new Date())})]); return json({ok:true}); }
      if (d.accion === 'guardarPlacas'){
        const sh = hoja(HOJA_PLACAS, ['Placa']);
        if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,1).clearContent();
        const v = (d.placas || []).map(x => [String(x).toUpperCase().trim()]).filter(x => x[0]);
        if (v.length) sh.getRange(2,1,v.length,1).setValues(v);
        return json({ok:true, total:v.length});
      }
      if (d.accion === 'guardarConfig'){ guardarConfig(d.config || {}); return json({ok:true}); }
      return json({ok:false, error:'Acción desconocida'});
    }

    // ---- Registro desde los teléfonos ----
    const regs = d.registros || [];
    upsert(regs);
    let correo = false;
    const dest = leerConfig().correo || d.correo;
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

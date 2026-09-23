const {app,BrowserWindow}=require('electron'),fs=require('fs'),http=require('http'),path=require('path');
const [swf,output,plugin]=process.argv.slice(2);
app.commandLine.appendSwitch('ppapi-flash-path',plugin);app.commandLine.appendSwitch('ppapi-flash-version','26.0.0.131');
app.commandLine.appendSwitch('allow-outdated-plugins');app.setPath('userData',path.join(path.dirname(output),'flash-profile'));
app.whenReady().then(async()=>{
 const server=http.createServer((req,res)=>{if(req.url==='/oracle.swf'){res.setHeader('Content-Type','application/x-shockwave-flash');fs.createReadStream(swf).pipe(res);}else {res.setHeader('Content-Type','text/html');res.end('<object id="flash" data="/oracle.swf" type="application/x-shockwave-flash" width="160" height="100"><param name="allowScriptAccess" value="always"></object>');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const win=new BrowserWindow({show:false,webPreferences:{offscreen:true,plugins:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
 try {
  await win.loadURL(`http://127.0.0.1:${server.address().port}/`);const deadline=Date.now()+20000;
  while(Date.now()<deadline){const value=await win.webContents.executeJavaScript("(()=>{const f=document.getElementById('flash');return f&&typeof f.snapshot==='function'?JSON.parse(f.snapshot()):null})()");
   if(value)fs.writeFileSync(output+'.partial',JSON.stringify(value)); if(value&&value.ready){fs.writeFileSync(output,JSON.stringify(value,null,2)+'\n');if(value.failure)throw Error(value.failure);return;}
   await new Promise(resolve=>setTimeout(resolve,30));
  }throw Error('Original parser oracle timeout');
 }catch(error){console.error(error.stack||error);process.exitCode=1;}
 finally{win.destroy();server.close();app.exit(process.exitCode||0);}
});

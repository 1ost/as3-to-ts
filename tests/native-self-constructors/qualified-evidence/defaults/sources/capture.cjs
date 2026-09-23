const {app,BrowserWindow}=require('electron');
const fs=require('fs'),http=require('http'),path=require('path');
const [swf,output,plugin]=process.argv.slice(2);
app.commandLine.appendSwitch('ppapi-flash-path',plugin);
app.commandLine.appendSwitch('ppapi-flash-version','26.0.0.131');
app.commandLine.appendSwitch('allow-outdated-plugins');
app.setPath('userData',path.join(path.dirname(output),'profile'));
app.whenReady().then(async()=>{
  const server=http.createServer((req,res)=>{
    if(req.url==='/oracle.swf'){res.setHeader('Content-Type','application/x-shockwave-flash');fs.createReadStream(swf).pipe(res);}
    else {res.setHeader('Content-Type','text/html');res.end('<object id="flash" type="application/x-shockwave-flash" data="/oracle.swf"><param name="allowScriptAccess" value="always"></object>');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const win=new BrowserWindow({show:false,webPreferences:{offscreen:true,plugins:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
  try {
    await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
    const deadline=Date.now()+20000;let result;
    do {
      result=await win.webContents.executeJavaScript("(()=>{const f=document.getElementById('flash');return f && typeof f.snapshot==='function'?JSON.parse(decodeURIComponent(f.snapshot())):null})()");
      if(result)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }while(Date.now()<deadline);
    if(!result)throw Error('Original Flash String-boundary oracle did not initialize');
    fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  }catch(error){console.error(error);process.exitCode=1;}
  finally{win.destroy();server.close();app.exit(process.exitCode||0);}
});

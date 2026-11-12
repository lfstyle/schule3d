// Nur über materials.js erzeugt. Farb-/Strukturannahmen: FLUR4-ABGLEICH.md.
export function addFlur4Materials(M,{std,noShadow,sign,acrylicRoomTexture,toTexture,makeCanvas,random}){
  M.flur4Wall=M.flur3Wall;
  M.flur4Wood=M.foyerPhotoWood;
  M.flur4Light=M.flur3Light.clone();
  M.sekretariatLight=M.flur3Light.clone();
  M.flur4Column=std({color:0x333b3b,roughness:.67});
  M.flur4Red=std({color:0x833b49,roughness:.58});
  M.flur4Skirt=std({color:0x929184,roughness:.8});
  M.flur4Cabinet=std({color:0xd9d8ca,roughness:.75});
  const [c,g]=makeCanvas(512,512),r=random(428);
  g.fillStyle='#c3c1ab';g.fillRect(0,0,512,512);
  for(let i=0;i<35000;i++){g.fillStyle=r()<.5?'rgba(68,69,58,.20)':'rgba(255,252,231,.28)';g.fillRect(r()*512,r()*512,.5+r(),.5+r()*1.5);}
  M.flur4Floor=std({map:toTexture(c),roughness:.58});
  const [pc,pg]=makeCanvas(64,64);pg.fillStyle='#929391';pg.fillRect(0,0,64,64);pg.fillStyle='#313435';
  for(let y=4;y<64;y+=8)for(let x=4;x<64;x+=8){pg.beginPath();pg.arc(x+(y%16?2:0),y,2,0,Math.PI*2);pg.fill();}
  M.flur4Perforated=std({map:toTexture(pc),roughness:.52,metalness:.35});
  // Beschriftung direkt auf dem Festglas (IMG_4761): nur Schrift, kein Schildträger.
  {const [rc,rg]=makeCanvas(512,320);rg.clearRect(0,0,512,320);rg.fillStyle='#1f1f1c';rg.textBaseline='alphabetic';
    rg.font='bold 40px sans-serif';rg.fillText('Schulleitung  225 - 231',10,48);rg.fillText('Sekretariat     228',10,96);
    rg.font='bold 34px sans-serif';rg.fillText('Öffnungszeiten',10,160);rg.fillRect(10,166,236,3);
    rg.font='22px sans-serif';rg.fillText('Montag - Freitag',10,212);rg.fillText('09.15 - 11.15 Uhr',300,212);
    rg.fillText('Montag & Dienstag',10,248);rg.fillText('14.00 - 16.00 Uhr',300,248);
    M.flur4ReceptionSign=noShadow(std({map:toTexture(rc,{repeat:false}),transparent:true,depthWrite:false,roughness:.5}));}
  // Helles Strukturglas im rötlichen Rahmen rechts der Tür (7.jpg, 8.jpg).
  {const [ac,ag]=makeCanvas(128,128),ar=random(77);ag.fillStyle='#f5f0e8';ag.fillRect(0,0,128,128);
    for(let i=0;i<900;i++){ag.fillStyle=ar()<.5?'rgba(255,255,255,.45)':'rgba(215,202,180,.18)';ag.fillRect(ar()*128,ar()*128,1+ar()*2,1+ar()*2);}
    M.flur4Amber=noShadow(std({map:toTexture(ac),color:0xffffff,transparent:true,opacity:.68,roughness:.35,depthWrite:false}));}
  M.flur4Distance=sign(['STOP! Bitte 1,5 Meter Abstand halten!'],{w:1024,h:96,size:42,bg:'#a93235',fg:'#ffffff'});
  M.flur4WC=sign(['WC'],{w:128,h:128,size:60,bg:'#eae9df',fg:'#862e42'});
  M.flur4TV=sign(['KSE','Ausbildung · Informationen'],{w:768,h:432,size:52,bg:'#253e50',fg:'#ede7df'});
  for(const [n,t] of [[226,''],[227,'OStD Kamm\nSchulleiter'],[228,'Sekretariat'],[229,''],['231b','']])
    M['flur4Room'+n]=noShadow(std({map:acrylicRoomTexture(n,t),transparent:true,depthWrite:false,roughness:.5}));
  // Milchglas der Oberlichter/Fenster: undurchsichtig, damit keine ungebauten Räume durchscheinen.
  M.flur4Milk=noShadow(std({color:0xeef1ef,roughness:.6}));   // ohne Eigenleuchten: nachts/bei Licht aus dunkel
  M.flur4Orange=noShadow(std({color:0xe0612b,roughness:.7}));
  // Wappen (schwarzer Adler mit Schild, 6.jpg/IMG_4761) als einfache Silhouette, Hintergrund transparent.
  {const [wc,wg]=makeCanvas(256,256);wg.fillStyle='#111';
    const poly=(pts,mirror=false)=>{wg.beginPath();pts.forEach(([x,y],i)=>{const X=mirror?256-x:x;i?wg.lineTo(X,y):wg.moveTo(X,y);});wg.closePath();wg.fill();};
    // Flügel mit gespreizten Federn, Schwanz, Fänge; Kopf mit Krone und Schnabel nach links.
    const wing=[[112,96],[98,62],[72,40],[42,30],[20,44],[40,54],[14,68],[38,78],[12,93],[40,101],[18,119],[48,123],[34,142],[70,136],[104,130],[114,124]];
    poly(wing);poly(wing,true);
    poly([[110,158],[90,206],[108,198],[114,218],[128,202],[142,218],[148,198],[166,206],[146,158]]);
    for(const m of [false,true]){poly([[114,160],[100,172],[86,176],[80,186],[92,182],[96,192],[102,180],[112,176],[120,166]],m);}
    wg.beginPath();wg.ellipse(128,122,27,46,0,0,Math.PI*2);wg.fill();
    wg.beginPath();wg.arc(128,62,15,0,Math.PI*2);wg.fill();
    poly([[114,62],[96,70],[112,75]]);
    poly([[115,50],[118,38],[123,46],[128,35],[133,46],[138,38],[141,50]]);
    // Schild: links gelb mit schwarzen Löwen (vereinfacht als Balken), rechts rot-weiß schräg gestreift.
    wg.save();wg.beginPath();wg.moveTo(106,92);wg.lineTo(150,92);wg.lineTo(150,124);wg.quadraticCurveTo(150,146,128,152);wg.quadraticCurveTo(106,146,106,124);wg.closePath();wg.clip();
    wg.fillStyle='#e6c329';wg.fillRect(106,92,22,62);wg.fillStyle='#fff';wg.fillRect(128,92,22,62);
    wg.fillStyle='#b7202e';for(let i=-2;i<5;i++){wg.save();wg.translate(128,92+i*16);wg.rotate(.65);wg.fillRect(0,-4,46,8);wg.restore();}
    wg.fillStyle='#111';for(let i=0;i<3;i++)wg.fillRect(111,100+i*15,13,5);wg.restore();
    M.flur4Wappen=noShadow(std({map:toTexture(wc,{repeat:false}),transparent:true,alphaTest:.4,roughness:.5}));}
  {const [ec,eg]=makeCanvas(512,352);eg.fillStyle='#ffffff';eg.fillRect(0,0,512,352);
    eg.fillStyle='#1d5fa8';eg.beginPath();eg.moveTo(0,90);eg.lineTo(512,40);eg.lineTo(512,352);eg.lineTo(0,352);eg.fill();
    eg.fillStyle='#233044';eg.beginPath();eg.moveTo(0,230);eg.lineTo(150,352);eg.lineTo(0,352);eg.fill();
    eg.fillStyle='#4aa83e';eg.beginPath();eg.arc(430,58,42,0,Math.PI*2);eg.fill();
    eg.fillStyle='#fff';eg.font='bold 28px sans-serif';eg.fillText('2017',400,68);
    eg.fillStyle='#1d5fa8';eg.font='26px sans-serif';eg.fillText('Erasmus+',90,48);eg.fillStyle='#163a8c';eg.fillRect(40,26,40,28);
    eg.fillStyle='#fff';eg.font='bold 34px sans-serif';eg.fillText('Mobilitätsprojekt',150,215);eg.font='22px sans-serif';eg.fillText('Erasmus+ Schulbildung',150,248);
    M.flur4Erasmus=noShadow(std({map:toTexture(ec,{repeat:false}),roughness:.45}));}
  {const [oc,og]=makeCanvas(640,136);og.fillStyle='rgba(235,240,240,.35)';og.fillRect(0,0,640,136);
    og.fillStyle='#7d1f2e';og.font='bold 64px sans-serif';og.textBaseline='middle';og.fillText('◄◄◄ 2. + 3. OG 301 - 411',24,70);
    M.flur4OgSign=noShadow(std({map:toTexture(oc,{repeat:false}),transparent:true,depthWrite:false,roughness:.4}));}
  // Kunstwerke nur grafisch angenähert. Keine unleserlichen Signaturen erfinden.
  M.flur4Art=['mosaik','gruen','stern','baum'].map((kind,j)=>{
    const [ac,ag]=makeCanvas(256,384);ag.fillStyle=['#15586c','#186f55','#171a1a','#e6e4dc'][j];ag.fillRect(0,0,256,384);
    if(j===0)for(let y=0;y<255;y+=25)for(let x=0;x<256;x+=25){ag.fillStyle=['#a3a924','#963431','#326e9a','#e1c675','#224e47'][Math.floor(r()*5)];ag.fillRect(x,y,23,23);}
    if(j===1){ag.strokeStyle='#a6c29a';ag.lineWidth=2;ag.strokeRect(68,125,120,135);ag.font='35px serif';ag.strokeText('KSE',85,205);}
    if(j===2){ag.fillStyle='#bd976c';ag.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?33:75;ag.lineTo(128+Math.cos(a)*rr,195+Math.sin(a)*rr);}ag.closePath();ag.fill();}
    if(j===3){ag.strokeStyle='#68685d';for(let i=0;i<30;i++){const x=40+r()*170,y=40+r()*190;ag.beginPath();ag.moveTo(125,310);ag.lineTo(x,y);ag.stroke();ag.fillStyle=i%2?'#61875a':'#a04c4f';ag.fillRect(x,y,7,12);}}
    return std({map:toTexture(ac,{repeat:false}),roughness:.95});
  });
}

// Werkstoffe für Flur 5 und den oberen Gang, nur über createMaterials() erzeugt.
// Kunstwerke sind grafische Annäherungen (keine Fotoausschnitte); unlesbare Schildtexte bleiben leer.
import * as THREE from 'three';
export function addFlur5Materials(M,{std,noShadow,acrylicRoomTexture,toTexture,makeCanvas,random}){
  // Eigene Leuchtenwerkstoffe je Lichtkreis (Schalten ändert deren Leuchtstärke).
  M.flur5Light=M.flur3Light.clone();
  M.obenLight=M.flur3Light.clone();
  M.flur5Pot=std({color:0x2e3134,roughness:.55});
  M.flur5Soil=M.flur3Soil;
  // Oberlichtband über 312: dunkles Glas, blickdicht (Raum dahinter nicht fotografiert).
  M.flur5DarkGlass=noShadow(std({color:0x3b4349,roughness:.18,metalness:.45}));
  M.flur5Skylight=noShadow(std({color:0xcfe2ea,transparent:true,opacity:.16,depthWrite:false,roughness:.05,side:THREE.DoubleSide}));
  M.flur5Sanitizer=std({color:0xeeece4,roughness:.4});
  for(const [n,t] of [[312,''],[313,'Putzraum'],[314,''],[315,'Klassenraum'],[316,''],[317,''],[318,''],[319,'']])
    M['flur5Room'+n]=noShadow(std({map:acrylicRoomTexture(n,t),transparent:true,depthWrite:false,roughness:.4}));
  {const [c,g]=makeCanvas(640,136);g.fillStyle='rgba(235,240,240,.35)';g.fillRect(0,0,640,136);
    g.fillStyle='#7d1f2e';g.font='bold 64px sans-serif';g.textBaseline='middle';g.fillText('3. OG 314 - 319 ►►►',24,70);
    M.flur5WaySign=noShadow(std({map:toTexture(c,{repeat:false}),transparent:true,depthWrite:false,roughness:.4}));}
  const r=random(512);
  // Leinwand an der Wand neben 312: dunkles Blau-Türkis mit orangem Farbklecks und Läufern (bild flur5.jpg).
  {const [c,g]=makeCanvas(512,384);
    const gr=g.createLinearGradient(0,0,512,0);gr.addColorStop(0,'#111a22');gr.addColorStop(.45,'#163447');gr.addColorStop(1,'#1f6a72');
    g.fillStyle=gr;g.fillRect(0,0,512,384);
    for(let i=0;i<2500;i++){g.fillStyle=r()<.5?'rgba(10,15,20,.25)':'rgba(70,160,150,.12)';g.fillRect(r()*512,r()*384,2,2);}
    g.fillStyle='#ef5a1c';g.beginPath();g.moveTo(30,120);g.quadraticCurveTo(110,60,230,70);g.quadraticCurveTo(270,110,240,170);g.lineTo(40,190);g.closePath();g.fill();
    for(let i=0;i<14;i++){const x=40+i*14+r()*6;g.fillRect(x,170,4+r()*3,40+r()*130);}
    M.flur5ArtSplash=std({map:toTexture(c,{repeat:false}),roughness:.85});}
  // Grünes Bild über dem PC-Tisch: blauer Himmel, rote Linie, grüne Fläche (8.jpg, 12.jpg).
  {const [c,g]=makeCanvas(512,384);g.fillStyle='#1b3c7a';g.fillRect(0,0,512,384);
    g.fillStyle='#3fae3a';g.beginPath();g.moveTo(0,190);g.quadraticCurveTo(220,90,512,120);g.lineTo(512,384);g.lineTo(0,384);g.fill();
    g.fillStyle='#8fd24a';g.beginPath();g.moveTo(140,384);g.quadraticCurveTo(330,170,512,220);g.lineTo(512,384);g.fill();
    g.strokeStyle='#a32a28';g.lineWidth=12;g.beginPath();g.moveTo(0,185);g.quadraticCurveTo(220,85,512,118);g.stroke();
    M.flur5ArtGreen=std({map:toTexture(c,{repeat:false}),roughness:.85});}
  // Zwei gerahmte Drucke an der Südwand: blau-schwarz bzw. gelb-blau auf weißem Passepartout (9.jpg).
  M.flur5Prints=['blau','gelb'].map((kind,j)=>{
    const [c,g]=makeCanvas(256,384);g.fillStyle='#f1efe8';g.fillRect(0,0,256,384);
    g.fillStyle='#e9e6dc';g.fillRect(28,30,200,300);
    const stroke=(col,x,y,w,h,rot)=>{g.save();g.translate(x,y);g.rotate(rot);g.fillStyle=col;g.fillRect(-w/2,-h/2,w,h);g.restore();};
    if(j===0){stroke('#1d2c6a',128,150,150,90,-.25);stroke('#0d1422',125,190,140,26,-.15);stroke('#3c58b4',130,120,120,22,-.35);stroke('#e4c23b',128,265,70,60,0);}
    else{stroke('#e4c23b',128,250,110,110,0);stroke('#1d2c6a',120,150,170,46,-.3);stroke('#0d1422',140,190,160,18,-.22);stroke('#7f8ba9',110,120,120,14,-.4);}
    return std({map:toTexture(c,{repeat:false}),roughness:.9});
  });
  // Plakate an der Doppeltür: nur Farbflächen, keine erfundenen Texte.
  {const [c,g]=makeCanvas(128,192);g.fillStyle='#f3f1ea';g.fillRect(0,0,128,192);
    g.fillStyle='#b9354a';g.fillRect(8,10,112,22);g.fillStyle='#d8d4c8';for(let i=0;i<9;i++)g.fillRect(12,44+i*15,104-(i%3)*18,5);
    M.flur5Poster=std({map:toTexture(c,{repeat:false}),roughness:.95});}
  M.flur5Hydrant=std({color:0x8b8e8c,roughness:.55,metalness:.25});
}

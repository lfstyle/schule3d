// Werkstoffe für die obere Halle, zentral über createMaterials() erstellt.
import * as THREE from 'three';
export function addFlur3Materials(M,{std,noShadow,photo,sign,acrylicRoomTexture,toTexture,makeCanvas,random}){
  M.flur3Wall=M.flur2Wall.clone();
  M.flur3Wood=M.foyerPhotoWood;
  M.flur3Glass=M.flur2Glass.clone();M.flur3Glass.opacity=.075;M.flur3Glass.roughness=.04;
  M.flur3Frame=M.flur2ExitMetal;
  M.flur3Light=M.flur2Light.clone();
  M.flur3Ceiling=M.foyerCeiling.clone();M.flur3Ceiling.emissiveIntensity=0;
  const [c,g]=makeCanvas(512,512),r=random(203);
  g.fillStyle='#986879';g.fillRect(0,0,512,512);
  for(let i=0;i<28000;i++){g.fillStyle=r()<.5?'rgba(245,224,224,.10)':'rgba(36,23,34,.08)';g.fillRect(r()*512,r()*512,1+r(),1+r());}
  g.strokeStyle='rgba(55,38,48,.15)';g.lineWidth=1;g.strokeRect(0,0,512,512);
  M.flur3Floor=std({map:toTexture(c),roughness:.72});
  M.flur3Inlay=std({color:0x7d7e80,roughness:.78});
  M.flur3Skirt=std({color:0x654952,roughness:.75});
  M.flur3BlueSeat=std({color:0x182535,roughness:.87});
  M.flur3OliveSeat=std({color:0x8b9461,roughness:.88});
  M.flur3TVBorder=std({color:0x424e51,roughness:.9});
  M.flur3Pot=std({color:0xa86643,roughness:.94});
  M.flur3Soil=std({color:0x30261f,roughness:1});
  M.flur3Bark=std({color:0x746349,roughness:1});
  const [lc,lg]=makeCanvas(64,128);lg.fillStyle='#46603b';lg.beginPath();lg.moveTo(32,2);lg.bezierCurveTo(-9,39,4,96,32,125);lg.bezierCurveTo(62,90,72,39,32,2);lg.fill();
  lg.strokeStyle='#75804b';lg.lineWidth=2;lg.beginPath();lg.moveTo(32,8);lg.lineTo(32,119);lg.stroke();
  M.flur3Leaf=std({map:toTexture(lc,{repeat:false}),alphaTest:.5,side:THREE.DoubleSide,roughness:.9});
  for(const [n,name] of [[220,''],[221,'Garderobe']]) M['flur3Room'+n]=noShadow(std({map:acrylicRoomTexture(n,name),transparent:true,depthWrite:false,roughness:.4}));
  for(const [key,file] of [['Jobs','ausbildungsangebote'],['Info','infotafel'],['Kinetik','kinetik'],['Career','berufswege'],['Liebherr','liebherr']])M['flur3'+key]=photo(std({roughness:.9}),'flur3/'+file+'.jpg');
  const titles=[['Leitbild'],['Offenheit','Wertschätzung','Unterstützung'],['Qualifizierung','Bildung','Erziehung'],['Zusammenarbeit','Zusammenleben'],['Qualität']];
  const quotes=[['Das wollen wir und das leben wir.'],['Wir wollen,','dass sich alle, die in','unserer Schule arbeiten','und lernen, wohlfühlen.'],['Wir','fördern und fordern.'],['Wir','gestalten Schule gemeinsam.'],['Wir','stellen die Qualität','unserer pädagogischen','Arbeit','sicher.']];
  M.flur3Banners=titles.map((lines,i)=>{
    const [bc,bg]=makeCanvas(384,1024);bg.fillStyle='#f2efdf';bg.fillRect(0,0,384,1024);
    bg.fillStyle='#79233d';bg.font='24px Arial';
    if(i===0){bg.font='54px Arial';bg.fillText('KSE',25,85);bg.font='40px Arial';bg.fillText('Leitbild',25,160);}
    else lines.forEach((s,j)=>{bg.fillStyle='#79233d';bg.fillRect(22,36+j*30,330,27);bg.fillStyle='#f5f0e4';bg.fillText(s,32,58+j*30);});
    bg.fillStyle='#853f50';bg.font='italic 25px Georgia';quotes[i].forEach((s,j)=>bg.fillText(s,25,210+j*34,340));
    // Unten verdeckte Texte nicht erfinden: nur dezente typografische Andeutung.
    bg.fillStyle='#7b6e68';for(let j=0;j<22;j++){bg.globalAlpha=.36;bg.fillRect(42,435+j*16,260-(j%4)*22,3);if(j%6===0){bg.globalAlpha=1;bg.fillStyle='#79233d';bg.fillRect(23,431+j*16,9,9);bg.fillStyle='#7b6e68';}}bg.globalAlpha=1;
    return std({map:toTexture(bc,{repeat:false}),roughness:1});
  });
  // Werbung der Schule (Nutzerbild) auf den Fernsehern in Flur 3 und Flur 4; leuchtet leicht wie ein Bildschirm.
  {const [pc,pg]=makeCanvas(4,4);pg.fillStyle='#2f6690';pg.fillRect(0,0,4,4);const ph=toTexture(pc,{repeat:false});
    M.kseWerbung=photo(noShadow(std({map:ph,emissive:0xffffff,emissiveMap:ph,emissiveIntensity:.35,roughness:.3})),'kse-werbung.jpg');}
  M.flur3Screen=M.kseWerbung;
}

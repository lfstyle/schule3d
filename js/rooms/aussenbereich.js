// Hof am blauen Foyerausgang. Maße geschätzt, Referenzen/Abgrenzung: PLANUNG 25.
import * as THREE from 'three';
import {PartBuilder,matrixFrom,metricBoxUV} from '../geometry.js';
import {addWall,addWindow} from '../objects.js';
import {HOF as F,HOF_REGIONS,inHof} from '../aussen-layout.js';
import {createVegetation} from '../aussen-vegetation.js';
import {MAUERWEG_RAMP,mauerwegY} from '../vorplatz-layout.js';
import {buildGartenEnde} from '../aussen-gartenende.js';

export function buildAussenbereich({scene,collision:C,materials:M,lighting,map,registerObject}){
  const root=new THREE.Group();root.name='aussenbereich';scene.add(root);
  const b=new PartBuilder(),facades=new PartBuilder(),detail=new PartBuilder();
  const plants=createVegetation(root,b,M,C);
  // Mauerweg: Gebäudeflucht (Außenfläche) und schräge Mauer von a nach e (Schätzung nach Plan/Fotos).
  const MW={face:9.4,a:[7.3,12.6],e:[19.8,11.0]};
  const anchor=(id,name,x,y,z)=>{const o=new THREE.Object3D();o.position.set(x,y,z);root.add(o);registerObject(id,'exterior',name,o);};
  const box=(mat,x0,y0,z0,x1,y1,z1,builder=b,tile=1)=>builder.add(mat,metricBoxUV(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),tile),matrixFrom((x0+x1)/2,(y0+y1)/2,(z0+z1)/2));
  const block=(id,x0,z0,x1,z1,y0,y1,tag='wand')=>C.addBox(x0,z0,x1,z1,y0,y1,{id,tag});
  function surface(mat,x0,z0,x1,z1,y,tile=1.6){
    const g=new THREE.PlaneGeometry(x1-x0,z1-z0);g.rotateX(-Math.PI/2);const p=g.attributes.position,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+(x0+x1)/2)/tile,(p.getZ(i)+(z0+z1)/2)/tile);
    b.add(mat,g,matrixFrom((x0+x1)/2,y,(z0+z1)/2));
  }
  // Pflasterfläche mit Gefälle entlang x (Mauerweg), Höhe nach mauerwegY.
  function rampSurface(mat,x0,z0,x1,z1,tile=1.6){
    const g=new THREE.PlaneGeometry(x1-x0,z1-z0,8,1);g.rotateX(-Math.PI/2);const p=g.attributes.position,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++){const x=p.getX(i)+(x0+x1)/2,z=p.getZ(i)+(z0+z1)/2;p.setY(i,mauerwegY(x));uv.setXY(i,x/tile,z/tile);}
    g.computeVertexNormals();b.add(mat,g,matrixFrom((x0+x1)/2,0,(z0+z1)/2));
  }
  function floor(x0,z0,x1,z1,y=F.y,mat=M.hofPaving){
    surface(mat,x0,z0,x1,z1,y);C.addBox(x0,z0,x1,z1,y-.18,y,{tag:'boden',surface:'tile',id:'hof_boden'});
    map.areas.push({poly:[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],fill:'rgba(157,153,126,.22)'});
  }
  // Kein überlappender Boden unter den Innenräumen; die Aussparung ist das tiefe Pflanzbeet.
  // Böden reichen 0,3 m unter die Gebäudewände, damit an den Wandfüßen kein Spalt zum Hintergrund bleibt
  // (Fehlerbilder „links der blauen Türen“, „Raum beim Aufenthaltsraum“).
  floor(-5.5,-.32,-.1,1.15);floor(-5.2,1.15,-.1,2.06);floor(-6.55,2.06,-.1,8.4);
  // Gartenweg: rechteckige Betonsteine (neu/1–3.jpg), Hof bleibt Fischgrät.
  floor(-27,8.4,-6.55,12.6,F.y,M.hofPathPaving);floor(-6.55,9.1,7.3,12.6);
  floor(-6.55,8.4,-.1,9.1);
  // Mauerweg hinter 132/131: Gebäudefront in einer Flucht mit dem Aufenthaltsraum (Plan), Weg verjüngt sich.
  // Ab x = 9 fällt der Weg zum Vorplatz an der Bucksgässle ab (Ausgang 130/131 drei Stufen über dem Platz,
  // vorplatz-layout.js); bis zum Gittertor −0,55.
  const R=MAUERWEG_RAMP;
  surface(M.hofPaving,7.3,9.1,R.x0,12.6,F.y);C.addBox(7.3,9.1,R.x0,12.6,F.y-.18,F.y,{tag:'boden',surface:'tile',id:'hof_boden'});   // unter die Front (Fehlerbild „langer Gang“)
  rampSurface(M.hofPaving,R.x0,9.1,R.x1,12.6);
  C.add({x:(R.x0+R.x1)/2,z:(9.1+12.6)/2,w:12.6-9.1,d:R.x1-R.x0,rot:Math.PI/2,bottom:R.y1-.3,slope:{h0:R.y0,h1:R.y1},tag:'boden',surface:'tile',id:'hof_boden'});
  map.areas.push({poly:[[7.3,9.4],[19.8,9.4],[19.8,MW.e[1]],[7.3,12.6]],fill:'rgba(157,153,126,.22)'});

  // Gitterrostschwelle: oberhalb des Pflasters, unter der vorhandenen Tür.
  grating(-5.16,-.23,-.43,.43,F.y+.006,true);
  // Niedriger Sockel bleibt exakt unter den bestehenden Außenwänden.
  box(M.hofBase,-.405,-.17,.02,-.397,.03,9.4,b,.6);
  box(M.hofBase,-.4,-.17,9.397,7.3,.03,9.405,b,.6);

  // Alte Grenzmauer: Naturstein am Mauerweg; der verputzte Abschnitt links (x < 1,1) ist zweistufig
  // nach neu/2.jpg und wird in aussen-gartenende.js gebaut.
  box(M.hofBase,1.1,-1.8,12.6,MW.a[0],1.02,13.05,b,2.2);
  box(M.hofStone,1.1,1.02,12.65,MW.a[0],6.1,13.10,b,3.2);
  for(let x=1.1;x<MW.a[0];x+=.44){b.box(M.hofCoping,.46,.07,.70,x+.22,6.18,12.89,0,0,.04);}
  block('hof_alte_mauer',-29.5,12.6,MW.a[0],13.15,-1.8,7);map.walls.push([-29.5,12.6,MW.a[0],12.6]);
  // Hinter 132/131 läuft die Mauer schräg auf das Gebäude zu (Rettungsplan, Foto „aus dem aufenthaltstram“):
  // Weg von 3,2 m auf ca. 1,6 m, am Ende Mauerstück mit grauer Stahltür (Foto „außen vor dem eingang“).
  // Am Ende das offene Gittertor zum Vorplatz (rooms/vorplatz.js); früher hier eine geschlossene Stahltür.
  slantedWall(MW.a,MW.e);
  // Westende: Weg biegt hinter dem Haus ab (Hecke als Spielgrenze).
  for(let x=-25.6;x<.1;x+=3.4)fence(x,12.04,Math.min(x+3.36,.2),12.04);

  // Hauptbaum und bodennahes Beet. Die begehbaren Wege verlaufen um dessen Rand.
  const tx=F.tree.x,tz=F.tree.z;
  const soil=new THREE.Mesh(new THREE.CircleGeometry(1.38,24),M.hofSoil);soil.rotation.x=-Math.PI/2;soil.position.set(tx,F.y+.008,tz);soil.receiveShadow=true;root.add(soil);
  for(let i=0;i<24;i++){const a=i*Math.PI/12;b.box(M.hofBase,.35,.07,.12,tx+Math.cos(a)*1.36,F.y+.03,tz+Math.sin(a)*1.36,0,-a+Math.PI/2);}
  plants.tree(tx,tz);block('hof_baumbeet',tx-1.10,tz-1.10,tx+1.10,tz+1.10,F.y,F.y+.58,'beet');
  for(let i=0;i<10;i++){const a=i*Math.PI/5;plants.shrub(tx+Math.cos(a)*.9,tz+Math.sin(a)*.9,{h:.65,w:.85,flower:true});}
  b.rod(M.hofMetal,[tx+.85,F.y,tz+.5],[tx+.85,5.3,tz+.5],.035,8); // Kopf auf Foto im Laub verdeckt.
  tableGroup(tx-.8,tz-2.25,'hof_sitzgruppe_baum');tableGroup(-11.8,10.80,'hof_sitzgruppe_mauer');
  anchor('hof_baum','Baum im Innenhof',tx,0,tz);map.furniture.push([tx-1.35,tz-1.35,tx+1.35,tz+1.35]);
  // Schmale immergrüne Pflanzen an der Mauer hinter der Lounge-Ecke.
  for(const [x,h]of[[1.2,3.8],[2.45,4.0],[3.65,3.5],[4.8,3.9]])plants.conifer(x,12.0,h);
  for(let x=.9;x<5.4;x+=.8)plants.shrub(x,12.2,{h:.33,w:.9});
  block('hof_koniferenbeet',.65,11.6,5.5,12.6,F.y,.75,'beet');
  box(M.hofBase,.65,F.y,11.57,5.5,.08,11.64);

  // Tieferes, nicht begehbares Beet; Geländer statt unsichtbarer Absturzkante.
  const d=F.bed;surface(M.hofSoil,d.x0,1.15,d.x1,d.z1,d.y,2);
  // Boden unter dem Metallsteg bis zum Hofanschluss und unter der Wendeltreppe lückenlos schließen.
  surface(M.hofSoil,-6.55,1.15,-5.2,2.06,d.y,2);
  surface(M.hofSoil,-27.84,1.15,-27.0,2.65,d.y,2);
  // Unter den durchbrochenen Stegen müssen Boden und Gebäudesockel weiterlaufen.
  box(M.hofBase,-27.84,d.y-.1,.92,-5.2,0,1.15,b,2.2);
  box(M.hofBase,d.x0,d.y,d.z1-.14,d.x1,.08,d.z1,b,2);
  box(M.hofBase,d.x1-.14,d.y,d.z0,d.x1,.08,d.z1,b,2);
  box(M.hofBase,-6.55,d.y,2.02,-5.2,.08,2.10,b,2);
  box(M.hofBase,-5.24,d.y,1.15,-5.16,.08,2.10,b,2);
  // Geländer am Wegrand mit Lücke für die Rampe zum Haus (neu/1.jpg); Bepflanzung, rote Sitzstufen
  // und Rampe stehen in aussen-gartenende.js. Das Beet ist rundum durch Geländer, Flügel und Haus begrenzt.
  rail([d.x1,d.z0],[d.x1,d.z1],F.y);rail([d.x0,d.z1],[-16.1,d.z1],F.y);rail([-13.9,d.z1],[d.x1,d.z1],F.y);

  // Lange äußere Hülle der noch ungebauten Klassenzimmer; keine erfundenen Innenräume.
  const sideWindows=[];
  for(const y of [.35,3.88,7.25])for(let x=-25;x<-6;x+=2.0)sideWindows.push({u:x+27.6,w:1.50,y,h:2.12});
  facade([-27.6,F.wingZ],[-5.2,F.wingZ],0,F.roof,sideWindows,.25);
  facade([-5.2,F.wingZ],[-5.2,-.25],0,F.roof,[],.25);
  // Gittergänge auf getrennten Höhen; Obergeschosse bleiben außerhalb der Laufstrecke.
  for(const y of [F.y+.01,3.45,6.82]){
    grating(-25.83,1.17,-5.2,2.06,y,y<1);rail([-25.83,2.03],[-5.25,2.03],y);
    for(let x=-25.4;x<-5.2;x+=3.4)b.box(M.hofMetal,.09,.16,.97,x,y-.09,1.62);
  }
  for(let x=-25.5;x<-5.2;x+=3.4){b.box(M.hofMetal,.12,7.85,.12,x,3.8,2.04);box(M.hofBase,x-.18,d.y,1.86,x+.18,F.y+.12,2.22);}
  for(const x of [-7.5,-13.9,-20.7]){b.rod(M.hofSeatColors[1],[x,3.5,2.04],[x,4.5,2.04],.022,8);b.rod(M.hofSeatColors[2],[x-.25,6.86,2.04],[x-.25,7.86,2.04],.022,8);}
  // Weißes Haus am Wegende mit Rampe/Steg, Wendeltreppe, Mauer, Birken und Wegbiegung (neu/1–3.jpg).
  buildGartenEnde({b,facades,detail,C,M,plants,F,box,block,facade,floor,grating});
  roofStrip(-27.6,-5.2,-.10,1.45,F.roof);

  // Obere Lounge-Hülle beginnt über deren vorhandener Decke, keine zweite EG-Wand.
  const westWins=[];for(const y of [5.62,8.72])for(const [z0,z1]of[[.7,3.7],[4.4,8.7]])westWins.push({u:z0+.25,w:z1-z0,y:y-4.9,h:1.75});
  facade([-.4,-.027],[-.4,9.4],4.9,11.35,westWins,.24);   // beginnt hinter Flur 3, nicht in dessen Eckfenster
  const southWins=[];for(const y of [5.62,8.72])for(const [x,w]of[[.6,1.4],[2.7,1.4],[5.1,1.25]])southWins.push({u:x+.4,w,y:y-4.9,h:1.75});
  facade([-.4,9.4],[7.3,9.4],4.9,11.35,southWins,.24);
  // Geschlossene Fortsetzung zur Straßenfassade: südliche Außenwand Raum 131 bleibt stehen.
  // Front von 132/131 zum Mauerweg in einer Flucht mit dem Aufenthaltsraum (Außenfläche z = 9,4).
  // Hinter Raum 131 (Innenwand z = 5,95) bleibt ein geschlossener Gebäudeteil; 132 ist begehbar (flur2.js).
  // Über 132 nur eine Fensterachse (Rettungsplan, Außenfoto fotos/fix), mittig im schmalen Raum; die
  // Achsen hinter 131 bleiben an ihrer bisherigen Stelle (u = linke Kante).
  const rearY0=-.6;   // reicht unter den abfallenden Weg
  const rearWins=[];for(const y of [2.1,5.5,8.7])for(const u of [10.0-.575-7.3,15.2-7.3,18.1-7.3])rearWins.push({u,w:1.15,y:y-rearY0,h:1.7,glass:y===2.1&&u<4?M.glass:undefined});   // 132: echtes Fenster
  // Wand liegt links der Laufrichtung, also innen: Außenfläche genau auf z = 9,4 wie beim Aufenthaltsraum
  // (vorher 22 cm zurückgesetzt, die Innenwand von 132 stand 1 cm vor der Fassade).
  facade([7.3,MW.face],[19.8,MW.face],rearY0,11.35,rearWins,.22);
  box(M.hofPlaster,19.4,-1.1,5.96,19.85,11.35,MW.face,facades,.65);
  roofStrip(-.6,7.5,-.45,9.6,11.4);roofStrip(7.3,20.0,4.0,MW.face+.25,11.4);
  // Fallrohre und sichtbares Außengerät am Ende des schmalen Gangs.
  for(const[x,z]of[[7.48,MW.face+.1],[19.6,MW.face+.1]]){
    b.rod(M.hofMetal,[x,mauerwegY(x)+.1,z],[x,11.4,z],.045,10);
    for(const y of [1.4,4.7,8.0])b.rod(M.hofMetal,[x,y,z],[x,y,z-.1],.012,6);
  }
  // Waagrechte Fugen im Sockel und Außengerät der Klimaanlage (Foto „aus dem aufenthaltstram“).
  for(let y=-.65;y<1.8;y+=.35)box(M.hofBase,y<0?R.x0:7.5,y,MW.face+.003,19.8,y+.008,MW.face+.009,detail);
  const ag=MW.face+.14;
  b.box(M.hofFrame,.72,.60,.29,18.65,2.55,ag);
  for(let y=2.32;y<2.8;y+=.045)b.box(M.hofGlass,.59,.016,.01,18.65,y,ag+.152);
  for(const x of [18.4,18.9])b.bar(M.hofMetal,[x,2.2,MW.face-.1],[x,2.2,ag+.16],.04,.04);

  // Foyer/Flur-3-Fassade nur zwischen/über den vorhandenen Geschossen schließen.
  box(M.hofFrame,-5.2,3.30,-.015,-.4,3.62,.015,facades);
  // Fenster von Flur 5 (flur5.js): Klarglas ohne Lamellen, Durchblick wie auf 8.jpg/11.jpg.
  facade([-.4,.015],[-5.2,.015],6.70,10.5,[[.12,.40],[.7,1.0],[1.82,1.0],[3.0,1.0],[4.15,.45]].map(([u,w])=>({u,w,y:.84,h:2.0,glass:M.flur3Glass,bars:false})),.16);
  // Umlaufende Laibung an der Gebäudeecke; keine Verglasung überdecken.
  box(M.hofPlaster,-.42,0,-.02,-.36,10.5,.06,facades,.65);
  // Dachabschluss als schlichte, von unten sichtbare Hülle ohne unbekannte Räume.
  roofStrip(-5.4,-.4,-.6,.35,10.6);
  // Bodenablauf und wenige Blätter, ohne tausende Einzelobjekte.
  grating(-6.35,8.6,-6.02,8.94,F.y+.007,false);
  const fallen=new THREE.InstancedMesh(new THREE.PlaneGeometry(.065,.10),M.hofFoliage,280);
  let seed=77;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<280;i++){const x=-6+rnd()*5.4,z=4.1+rnd()*7.4;fallen.setMatrixAt(i,matrixFrom(x,F.y+.011,z,-Math.PI/2,0,rnd()*6.28));fallen.setColorAt(i,new THREE.Color(0xc3ac65));}
  fallen.name='hof_falllaub';fallen.computeBoundingSphere();root.add(fallen);
  const vegetation=plants.build();root.userData.vegetation=vegetation;
  const facadeGroup=facades.build({name:'hof_fassaden'});
  facadeGroup.traverse(o=>{if(o.isMesh&&o.material===M.hofPlaster)metricBoxUV(o.geometry,.65);});
  root.add(b.build({name:'hof_boden_mauer_ausstattung'}),facadeGroup,detail.build({name:'hof_feindetails',castShadow:false}));
  map.labels.push({text:'Innenhof',x:-3.5,z:4.1},{text:'Mauerweg',x:8.7,z:11},{text:'Gartenweg',x:-19,z:10.3});
  anchor('aussenbereich','Innenhof',-3.5,0,4.1);
  // Empfangszone für Innenlicht durch die vorhandene Eingangstür; keine zusätzliche Echtzeitlampe.
  const circuit=lighting.addCircuit('licht_hof',{lights:[],panels:[],regions:HOF_REGIONS,on:false});circuit.roomId='aussenbereich';
  // Schwacher Lichtschein durch die tatsächlich vorhandenen Lounge-Fenster.
  const loungeLink={rooms:['licht_aufenthaltsraum','licht_hof'],transmission:.35,power:.18,range:4.6};
  for(const [id,z,y,w,h]of[['oben',6.55,3.76,4.3,1.84],['vorne',1.85,3.275,1.7,1.65]])
    lighting.portals.add({...loungeLink,id:'hof_lounge_'+id,center:[-.2,y,z],normal:[-1,0],width:w,height:h});
  lighting.portals.add({...loungeLink,id:'hof_lounge_sued',center:[2.875,3.76,9.2],normal:[0,1],width:2.65,height:2.12});
  return {id:'aussenbereich',name:'Innenhof',root,regions:HOF_REGIONS,
    bounds:{minX:-38,maxX:20.2,minZ:-.125,maxZ:17.6,minY:-2,maxY:11.7},
    areaName:p=>inHof(p)?(p.x>7.3?'Außenbereich · Mauerweg':p.x<-7?'Außenbereich · Gartenweg':'Innenhof'):null};

  function facade(a,d,y0,top,openings=[],thickness=.24){
    const res=addWall(facades,M,{start:a,end:d,y0,height:top-y0,thickness,openings,material:M.hofPlaster,baseboard:false});
    res.colliders.forEach(c=>C.add({...c,tag:'fassade'}));
    if(y0<.1)map.walls.push(...res.segments);
    const len=res.length,dx=(d[0]-a[0])/len,dz=(d[1]-a[1])/len;
    for(const o of openings){
      const u=o.u+o.w/2,x=a[0]+dx*u,z=a[1]+dz*u;
      // Türöffnung: Tür selbst baut der Aufrufer; geschlossen, daher nur der Kollider.
      if(o.door){C.add({x,z,w:o.w,d:thickness,rot:res.rot,bottom:y0+o.y,top:y0+o.y+o.h,tag:'tuer'});continue;}
      detail.push(x,y0+o.y+o.h/2,z,res.rot);addWindow(detail,M,{w:o.w,h:o.h,frame:M.hofFrame,glass:o.glass??M.hofGlass,inset:.07,sill:false,rows:[{f:.25,cols:1},{f:.75,cols:2}]});
      if(o.bars!==false)for(let yy=o.h*.03;yy<o.h*.47;yy+=.052)detail.box(M.hofFrame,o.w-.05,.026,.035,0,yy,.015);
      detail.box(M.hofFrame,o.w+.03,.09,.09,0,o.h/2+.035,.015);detail.pop();
      C.add({x,z,w:o.w,d:thickness,rot:res.rot,bottom:y0+o.y,top:y0+o.y+o.h,tag:'fenster'});
    }
  }
  function slantedWall(a,e){
    const len=Math.hypot(e[0]-a[0],e[1]-a[1]),dx=(e[0]-a[0])/len,dz=(e[1]-a[1])/len,rot=-Math.atan2(dz,dx);
    const nx=-dz,nz=dx;   // nach außen (vom Weg weg)
    const at=(t,off)=>[a[0]+dx*t+nx*off,a[1]+dz*t+nz*off];
    // Stücke enden genau bei e: dort setzt das Steinhaus des Vorplatzes an (rooms/vorplatz.js).
    const piece=(mat,off,th,y0,y1,tile,t0=-.25,t1=len)=>{const[cx,cz]=at((t0+t1)/2,off+th/2);b.add(mat,metricBoxUV(new THREE.BoxGeometry(t1-t0,y1-y0,th),tile),matrixFrom(cx,(y0+y1)/2,cz,0,rot,0));};
    piece(M.hofBase,0,.45,-1.8,1.02,2.2);piece(M.hofStone,.05,.45,1.02,6.1,3.2);
    // Bemooster Betonsockel 30 cm vor dem Stein, endet vor dem offenen Gittertor (aus dem aufenthaltstram.JPEG,
    // Fotos „sicht von außenbreich1 … zu außenbereich Eingang“, „sicht zu Mauerweg“).
    const ledge=len-1.55;piece(M.hofMossWall,-.3,.3,-1.8,1.02,1.6,1.2,ledge);
    for(let t=.2;t<len;t+=.44){const[cx,cz]=at(t,.29);b.box(M.hofCoping,.46,.07,.70,cx,6.18,cz,0,rot,.04);}
    // Dachtraufe des Steinhauses (Ziegelkante auf allen Mauerweg-Fotos), gleiche Neigung wie am Vorplatz.
    {const run=3.6,ang=THREE.MathUtils.degToRad(40),sl=run/Math.cos(ang),[cx,cz]=at(len/2,-.35+run/2);
      b.push(cx,6.12+run*Math.tan(ang)/2,cz,rot);b.box(M.hofRoof,len,.12,sl,0,0,0,-ang);b.pop();
      const[gx,gz]=at(len/2,-.33);b.push(gx,6.08,gz,rot);b.rod(M.hofCoping,[-len/2,0,0],[len/2,0,0],.06,8);b.pop();}
    const[cx,cz]=at(len/2,.25);C.add({x:cx,z:cz,w:len+.4,d:.5,rot,bottom:-1.8,top:7,tag:'wand',id:'hof_alte_mauer_schraeg'});
    {const[lx,lz]=at((1.2+ledge)/2,-.15);C.add({x:lx,z:lz,w:ledge-1.2,d:.3,rot,bottom:-1.8,top:1.02,tag:'wand',id:'hof_betonsockel'});}
    map.walls.push([a[0],a[1],e[0],e[1]]);
    for(const[t,y,w,h]of[[1.4,1.9,2,.9],[7.9,2.1,3,1]]){const[x,z]=at(t,-.1);plants.ivy(x,y,z,w,h,0x9caf81);}
  }
  function roofStrip(x0,x1,z0,z1,y){
    box(M.hofRoof,x0,y,z0,x1,y+.13,z1,facades,3);
    b.rod(M.hofCoping,[x0,y-.07,z1],[x1,y-.07,z1],.075,10);
  }
  function grating(x0,z0,x1,z1,y,walk){
    // Feinraster in einem einzigen zusammengeführten Mesh, kein geschlossener schwarzer Block.
    for(let x=x0;x<x1;x+=.035)detail.box(M.hofMetal,.007,.022,z1-z0,x,y,(z0+z1)/2);
    for(let z=z0;z<z1;z+=.14)detail.box(M.hofMetal,x1-x0,.016,.007,(x0+x1)/2,y-.004,z);
    if(walk)C.addBox(x0,z0,x1,z1,y-.09,y+.011,{tag:'boden',surface:'metal',id:'hof_gitterrost'});
  }
  function rail(a,d,y){
    const len=Math.hypot(d[0]-a[0],d[1]-a[1]);
    for(let i=0,n=Math.ceil(len/1.55);i<=n;i++){const t=i/n,x=a[0]+(d[0]-a[0])*t,z=a[1]+(d[1]-a[1])*t;b.rod(M.hofMetal,[x,y,z],[x,y+1.04,z],.025,7);}
    for(const h of [.49,1.04])b.rod(M.hofMetal,[a[0],y+h,a[1]],[d[0],y+h,d[1]],.028,8);
    C.add({x:(a[0]+d[0])/2,z:(a[1]+d[1])/2,w:len,d:.10,rot:-Math.atan2(d[1]-a[1],d[0]-a[0]),bottom:y,top:y+1.08,tag:'gelaender'});
  }
  function fence(x0,z0,x1,z1,end=false){
    const len=Math.hypot(x1-x0,z1-z0),rot=-Math.atan2(z1-z0,x1-x0);
    detail.push(x0,F.y,z0,rot);
    for(const x of [0,len]){detail.rod(M.hofMetal,[x,.13,0],[x,2.03,0],.019,7);detail.box(M.hofBase,.55,.12,.23,x,.06,0);}
    for(const y of [.17,2.03])detail.rod(M.hofMetal,[0,y,0],[len,y,0],.017,7);
    for(let x=.08;x<len;x+=.14)detail.bar(M.hofMetal,[x,.18,0],[x,2.02,0],.004,.004);
    for(let y=.32;y<2.02;y+=.2)detail.bar(M.hofMetal,[0,y,0],[len,y,0],.004,.004);
    detail.box(M.hofFenceSign,.22,.065,.006,.23,1.65,-.022);
    // Nur Linien andeuten: unleserlichen Text nicht erfinden.
    for(let i=0;i<2;i++)detail.box(M.hofGlass,.15,.004,.002,.23,1.645-i*.014,-.027);
    detail.pop();C.add({x:(x0+x1)/2,z:(z0+z1)/2,w:len,d:.12,rot,bottom:F.y,top:2.06,tag:'zaun',id:end?'hof_kartenende':'hof_bauzaun'});
    if(end)map.walls.push([x0,z0,x1,z1]);
  }
  function tableGroup(x,z,id){
    b.cylinder(M.hofMetal,.032,.032,1.04,x,.50,z,10);
    b.cylinder(M.hofPerforated,.34,.34,.032,x,1.04,z,28);
    b.add(M.hofMetal,new THREE.TorusGeometry(.42,.019,6,28),matrixFrom(x,.37,z,Math.PI/2));
    b.rod(M.hofMetal,[x-.42,.37,z],[x+.42,.37,z],.015,7);
    block(id,x-.35,z-.35,x+.35,z+.35,F.y,1.07,'tisch');
    const seats=[[-.85,.42,0,0],[0,.90,1,0],[.83,.43,2,0],[-.64,-.5,3,.65],[.60,-.50,4,-.65]];
    for(const[sx,sz,k,tilt]of seats){
      b.cylinder(M.hofSeatColors[k],.028,.028,.79,x+sx,.38,z+sz,9);
      b.cylinder(M.hofSeatColors[k],.16,.16,.027,x+sx,.80,z+sz,22,tilt);
      // Ein kleiner perforierter Einsatz erhält die Farbe des Sitzes durch den Rahmen.
      b.cylinder(M.hofPerforated,.14,.14,.005,x+sx,.816,z+sz,22,tilt);
      block(id+'_sitz_'+k,x+sx-.18,z+sz-.18,x+sx+.18,z+sz+.18,F.y,.88,'stuhl');
    }anchor(id,'Metall-Stehtisch mit Sitzflächen',x,0,z);
    map.furniture.push([x-1,z-.7,x+1,z+1.1]);
  }
}

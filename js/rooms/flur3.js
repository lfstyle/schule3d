// Obere Halle über dem Foyer. 25 Referenzen, Schätzmaße: PLANUNG 24.
import * as THREE from 'three';
import { PartBuilder, matrixFrom, metricBoxUV } from '../geometry.js';
import { addWall, addWindow, Door, createDoubleDoor, addHighTable, addHighSeat,
  addMobileBoard, addRadiator, addSlatBench, addCeilingLight, addSwitchPlate,
  addTrashBin, createWallClock } from '../objects.js';
import { FLUR3, returnStairRegions } from '../flur3-layout.js';
import { LAYOUT as LOUNGE } from './aufenthaltsraum.js';
export { FLUR3 } from '../flur3-layout.js';

export function buildFlur3(ctx){
  const {scene,collision:C,materials:M,registerObject,interactions,lighting,audio,map}=ctx;
  const F=FLUR3,Y=F.y,H=F.roof-Y,root=new THREE.Group();root.name='flur_3';scene.add(root);
  const walls=new PartBuilder(),b=new PartBuilder(),fixtures=new PartBuilder(),lights=[];
  const plane=(mat,w,h,x,y,z,ry=0)=>b.add(mat,new THREE.PlaneGeometry(w,h),matrixFrom(x,y,z,0,ry));
  const anchor=(id,type,name,x,y,z,obj=null)=>{
    const o=obj??new THREE.Object3D();if(!obj){o.position.set(x,y,z);root.add(o);}registerObject(id,type,name,o);return o;
  };
  const wall=(a,d,openings=[],{y0=Y,top=F.roof,mat=M.flur3Wall,dado=false}={})=>{
    const r=addWall(walls,{...M,baseboard:M.flur3Skirt},{start:a,end:d,openings,y0,height:top-y0,thickness:.22,material:mat,baseboard:y0===Y||y0===F.upper});
    r.colliders.forEach(c=>C.add({...c,tag:'wand'}));map.walls.push(...r.segments);
    if(dado){
      b.push(a[0],y0,a[1],r.rot);let u=0;
      for(const o of [...openings.filter(o=>o.y<.05).sort((a,d)=>a.u-d.u),{u:r.length,w:0}]){
        if(o.u>u)b.box(M.flur2Dado,o.u-u,.88,.012,(u+o.u)/2,.44,.008);u=o.u+o.w;
      }b.pop();
    }return r;
  };
  function surface(mat,x0,z0,x1,z1,y,down=false,tile=1){
    const geo=new THREE.PlaneGeometry(x1-x0,z1-z0);geo.rotateX(down?Math.PI/2:-Math.PI/2);
    const p=geo.attributes.position,uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(p.getX(i)+(x0+x1)/2)/tile,(p.getZ(i)+(z0+z1)/2)/tile);
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set((x0+x1)/2,y,(z0+z1)/2);mesh.receiveShadow=true;root.add(mesh);return mesh;
  }
  function floor(x0,z0,x1,z1,y=Y){surface(M.flur3Floor,x0,z0,x1,z1,y,false,2);C.addBox(x0,z0,x1,z1,y-.12,y,{tag:'boden',surface:'lino'});}
  function roof(x0,z0,x1,z1,y=F.roof,mat=M.flur3Ceiling){
    surface(mat,x0,z0,x1,z1,y,true,mat===M.flur3Ceiling?5:.6);
    surface(M.foyerRoof,x0,z0,x1,z1,y+.12).castShadow=true;
    C.addBox(x0,z0,x1,z1,y,y+.13,{tag:'decke'});
  }
  function acrylic(mat,w,h,x,y,z,ry=0){
    b.push(x,y,z,ry);plane(mat,w,h,0,0,.025);
    for(const u of [-w/2+.018,w/2-.018])for(const v of [-h/2+.018,h/2-.018])b.cylinder(M.chrome,.008,.008,.014,u,v,.027,8,Math.PI/2);b.pop();
  }
  function door(id,x,z,ry,{transom=false,sign=null}={}){
    const d=new Door({...M,glass:M.foyerWireGlass},{id,width:1.02,openingWidth:1.14,openingHeight:transom?H:2.25,
      leafHeight:2.18,transom,frontMaterial:M.flur3Wood,backMaterial:M.flur3Wood,leafMaterial:M.flur3Wood,frameMaterial:M.flur3Frame,wallThickness:.22});
    d.group.position.set(x,Y,z);d.group.rotation.y=ry;root.add(d.group);
    C.add({x,z,w:1.14,d:.22,rot:ry,bottom:Y,top:transom?F.roof:Y+2.25,tag:'tuer',id});
    anchor(id,'door',(id.endsWith('220')?'220':id.endsWith('221')?'221 · Garderobe':'Tür am Treppenabsatz')+' · geschlossen',x,Y,z,d.group);
    if(sign)acrylic(sign,.22,.19,x+Math.cos(ry)*.75,Y+1.6,z-Math.sin(ry)*.75,ry);
    if(transom){b.push(x,Y,z,ry);for(const s of [-1,1])b.box(M.entranceBlue,.10,.11,.025,s*.52,2.25,.037);b.pop();}
  }
  // Geschossplatte liegt über dem vorhandenen Foyerdach (bis 3,48 m).
  floor(F.west,F.north,F.east,F.south);floor(F.west,F.nicheZ,F.nicheX,F.north);
  roof(F.west,F.north,F.east,F.south);roof(F.west,F.nicheZ,F.nicheX,F.north,F.roof,M.flur2Ceiling);
  // Graue Linoleumeinlage als schmale Umrandung, innen derselbe violette Belag.
  for(const z of [-3.9,-1.05])surface(M.flur3Inlay,-3.65,z,3.5,z+.035,Y+.002);
  for(const x of [-3.65,3.465])surface(M.flur3Inlay,x,-3.865,x+.035,-1.05,Y+.002);
  map.areas.push({poly:[[F.west,F.nicheZ],[F.nicheX,F.nicheZ],[F.nicheX,F.north],[F.east,F.north],[F.east,F.south],[F.west,F.south]],fill:'rgba(174,113,143,.3)'});
  map.labels.push({text:'Flur 3',x:0,z:-4.7});

  // Westwand: TV-Feld und geschlossene Doppeltür zum noch nicht gebauten Folgeflur.
  wall([F.west,F.south],[F.west,F.nicheZ],[{u:4.25,w:2,y:0,h:H}],{dado:true});
  const pair=createDoubleDoor({...M,foyerWood:M.flur3Wood,glass:M.foyerWireGlass},{width:2,height:H,leafHeight:2.2});
  pair.group.position.set(F.west,Y,-5.5);pair.group.rotation.y=Math.PI/2;root.add(pair.group);
  C.addBox(F.west-.15,-6.5,F.west+.07,-4.5,Y,F.roof,{tag:'tuer',id:'flur3_doppeltuer'});
  anchor('flur3_doppeltuer','door','Weiterer Flur · vorerst geschlossen',F.west,Y,-5.5,pair.group);
  for(const [i,mat]of[M.flur3Liebherr,M.flur3Kinetik].entries()){
    const leaf=pair.leaves[i],p=new THREE.Mesh(new THREE.PlaneGeometry(.32,.50),mat);
    p.position.set(leaf.centerX-leaf.dir*.18,1.55,.029);leaf.pivot.add(p);
  }
  b.box(M.flur3TVBorder,.026,H,3.55,F.west+.014,Y+H/2,-2.38);
  b.box(M.flur3Wall,.008,2.14,2.92,F.west+.032,Y+1.63,-2.38);
  b.push(F.west+.11,Y+2.45,-2.45,Math.PI/2);
  b.box(M.steelBlack,1.30,.76,.065);plane(M.flur3Screen,1.23,.69,0,0,.034);b.pop();
  const clock=createWallClock(M);clock.position.set(F.west+.05,Y+2.55,-3.47);clock.rotation.y=Math.PI/2;root.add(clock);
  b.box(M.steelBlack,.10,.19,.12,F.west+.10,Y+2.59,-1.42);
  b.rod(M.steelBlack,[F.west+.05,Y+2.62,-1.48],[F.west+.05,Y+2.62,-2.05],.006,6);
  anchor('flur3_monitor','decoration','Bildschirm und Uhr',F.west,Y+2.5,-2.45);

  // Die Nische gehört zum Flur, die Räume 220/221 noch nicht.
  wall([F.west,F.nicheZ],[F.nicheX,F.nicheZ],[{u:.73,w:1.14,y:0,h:H}],{mat:M.flur3Wood});
  door('flur3_220',-3.9,F.nicheZ,0,{transom:true,sign:M.flur3Room220});
  wall([F.nicheX,F.nicheZ],[F.nicheX,F.north],[{u:3.03,w:1.14,y:0,h:H}],{mat:M.flur3Wood});   // Nische nach Nutzerfoto verlängert
  door('flur3_221',F.nicheX,-8.6,-Math.PI/2,{transom:true,sign:M.flur3Room221});
  wall([F.nicheX,F.north],[1.0,F.north],[{u:.06,w:3.48,y:2.12,h:.94}],{mat:M.flur3Wood});
  b.push(-.8,Y+2.59,F.north,0);addWindow(b,M,{w:3.48,h:.94,frame:M.partitionFrame,glass:M.foyerWireGlass,inset:.10,rows:[{f:1,cols:3}],sill:false});b.pop();
  for(const x of [-1.4,-.2])b.box(M.flur3Skirt,.009,2.12,.012,x,Y+1.06,F.north+.007);
  plane(M.flur3Career,.42,.84,-1.95,Y+1.56,F.north+.019);
  plane(M.paper,.21,.15,-1.35,Y+1.83,F.north+.020);
  b.pushMatrix(matrixFrom(-2.16,Y,F.north+.30,0,0,0,.9,1.5,.9));addTrashBin(b,{...M,binBag:M.flur2Red},0,0);b.pop();
  C.addBox(-2.34,F.north+.12,-1.98,F.north+.48,Y,Y+.75,{tag:'muell'});
  wall([1.0,F.north],[F.east,F.north],[{u:.80,w:1.14,y:0,h:2.25},{u:2.65,w:1.03,y:0.03,h:2.25}],{dado:true});
  door('flur3_tuer_absatz',2.37,F.north,0);
  b.push(4.165,Y+1.155,F.north);addWindow(b,M,{w:1.03,h:2.25,inset:.1,frame:M.flur2Red,glass:M.foyerWireGlass,rows:[{f:.28,cols:1},{f:.72,cols:1}],sill:false});b.pop();
  plane(M.fireSign,.12,.15,2.79,Y+2.04,F.north+.036);
  b.box(M.red,.13,.13,.06,4.94,Y+1.33,F.north+.04);plane(M.fireAlarmFace,.115,.115,4.94,Y+1.33,F.north+.072);
  cabinet(.93,F.north+.30);

  // Fensterfront über dem blauen Foyereingang; gleiche Fassadenachse.
  const wins=[[-5.04,-4.60],[-4.48,-3.43],[-3.38,-2.32],[-2.00,-.90],[-.58,-.18]];
  wall([-.03,F.south],[F.west,F.south],wins.map(([a,d])=>({u:-.03-d,w:d-a,y:.10,h:2.88})));
  for(const [a,d]of wins){
    const w=d-a,x=(a+d)/2;
    b.push(x,Y+1.54,F.south,Math.PI);addWindow(b,M,{w,h:2.88,inset:.14,frame:w>.6?M.windowFrame:M.flur3Frame,glass:M.flur3Glass,rows:[{f:.25,cols:1},{f:.52,cols:1},{f:.23,cols:1}],sill:false});
    if(w<.6){for(const s of [-1,1]){b.box(M.entranceBlue,w-.07,.035,.025,0,1.09+s*.26,-.10);b.box(M.entranceBlue,.035,.55,.025,s*(w/2-.055),1.09,-.10);}}
    b.pop();
    b.rod(M.handrailWood,[a+.04,Y+.89,F.south-.07],[d-.04,Y+.89,F.south-.07],.025,10);
    b.push(x,Y,F.south-.10,Math.PI);addRadiator(b,M,{width:w-.12,height:.20,depth:.12,y0:.08});b.pop();
    C.addBox(a,F.south-.08,d,F.south+.15,Y,F.roof,{tag:'fenster'});
    if(w>1){b.push(x,Y,F.south-.33);addSlatBench(b,M,{length:w-.14});b.pop();C.addBox(a+.04,F.south-.52,d-.04,F.south-.14,Y,Y+.45,{tag:'bank'});}
  }
  // Gemeinsame Wand: bis 4,90 m ist sie bereits im Aufenthaltsraum gebaut.
  // Nur die flurseitige Oberfläche ergänzen, keinen zweiten Wand-/Kollisionsblock.
  // Die vier kleinen Glasfelder bleiben blickdicht, ihr Zielraum ist nicht belegt.
  const small=[.65,1.77,2.89,4.01];
  wall([F.east,F.south],[-.03,F.south],[],{y0:LOUNGE.height+.002});
  plane(M.flur3Wall,F.east+.03,LOUNGE.height+.004-Y,(F.east-.03)/2,(Y+LOUNGE.height+.004)/2,F.south-.002,Math.PI);
  // Der alte Tür-Collider endet am EG-Oberlicht; den massiven Bereich darüber ergänzen.
  C.addBox(LOUNGE.door.x-LOUNGE.door.openingWidth/2,F.south,LOUNGE.door.x+LOUNGE.door.openingWidth/2,0,Y,LOUNGE.height+.002,{tag:'wand',id:'flur3_wand_ueber_foyertuer'});
  b.box(M.flur3Skirt,F.east+.03,.07,.012,(F.east-.03)/2,Y+.035,F.south-.009);
  for(const x of small){b.push(x,Y+.80,F.south-.025,Math.PI);addWindow(b,M,{w:.46,h:.48,inset:0,frame:M.partitionFrame,glass:M.frosted,sill:false});b.pop();}
  M.flur3Banners.forEach((mat,i)=>{
    const x=4.51-i*.90;plane(mat,.77,1.55,x,Y+2.25,F.south-.018,Math.PI);
    for(const yy of [Y+1.47,Y+3.03])b.box(M.aluminium,.79,.018,.028,x,yy,F.south-.025);
  });
  wall([F.east,F.south],[F.east,F.stairSouth],[],{dado:true});

  // Drei Sitzgruppen, mit breitem Weg an der Holzfront und zur Treppe.
  for(const [i,x]of[-2.8,-.1,2.6].entries()){
    const z=-2.65,ry=Math.PI/2;
    b.push(x,Y,z,ry);addHighTable(b,M,{length:1.95,depth:.65,height:1.09});b.pop();
    C.addBox(x-.325,z-.975,x+.325,z+.975,Y+.98,Y+1.09,{tag:'tisch',id:'flur3_hochtisch_'+i});
    for(const sx of [-.265,.265])for(const sz of [-.90,.90])C.addBox(x+sx-.025,z+sz-.025,x+sx+.025,z+sz+.025,Y,Y+1.05,{tag:'tisch'});
    seat(x-.63,z,1.65,M.flur3BlueSeat,ry);
    for(const dz of [-.62,.62])seat(x+.64,z+dz,.43,i===0?M.stoolBrown:M.flur3OliveSeat,ry);
    map.furniture.push([x-.85,z-1,x+.87,z+1]);anchor('flur3_hochtisch_'+i,'table','Hochtischgruppe',x,Y,z);
  }
  function seat(x,z,len,mat,ry){b.push(x,Y,z,ry);addHighSeat(b,M,{length:len,depth:.42,material:mat});b.pop();C.add({x,z,w:len,d:.42,rot:ry,bottom:Y,top:Y+.74,tag:'stuhl'});}
  // Normale Informationsaufstellung aus raum11; keine zusätzlichen Europatag-Tafeln.
  for(const [x,mat,id]of[[3.60,M.flur3Jobs,'ausbildung'],[1.90,M.flur3Info,'info']]){
    b.push(x,Y,F.south-.45,Math.PI);addMobileBoard(b,M,mat,{width:1.56,height:1.32});b.pop();
    C.addBox(x-.81,F.south-.74,x+.81,F.south-.16,Y,Y+2.16,{tag:'stellwand'});
    anchor('flur3_tafel_'+id,'decoration',id==='info'?'Infotafel':'Ausbildungsplatzangebote',x,Y+1.5,F.south-.45);
  }
  // Kleiner Prospekttisch vor den Tafeln (raum11), außerhalb des Hauptgangs.
  b.push(3.85,Y,F.south-.58);addHighTable(b,M,{length:.95,depth:.42,height:.76});
  for(let i=0;i<4;i++){
    b.box(M.paper,.14,.006,.20,-.31+i*.20,.764,0);
    b.add(i%2?M.flur3Career:M.flur3Liebherr,new THREE.PlaneGeometry(.135,.19),matrixFrom(-.31+i*.20,.768,0,-Math.PI/2));
  }b.pop();C.addBox(3.375,F.south-.79,4.325,F.south-.37,Y,Y+.77,{tag:'tisch'});
  plant(-4.18,-1.02);

  // Rücklauftreppe ersetzt ausschließlich den früheren Platzhalter in flur.js.
  flight(F.y,F.lower,F.stairNorth,-3.62,M.stairYellow,'flur3_treppe');
  rail(F.east,F.stairEnd,-3.61,F.y,F.lower);
  // Neben dem Abgang: fotografierter Aufgang bis zum vorerst abgeschlossenen Absatz.
  flight(F.y,F.upper,-3.5,F.stairSouth,M.aluminium,'flur3_weiterer_aufgang');
  rail(F.east,F.stairEnd,-3.49,F.y,F.upper);
  floor(F.stairEnd,-3.5,F.upperEnd,F.stairSouth,F.upper);
  // Über den Läufen offen bis zum Oberlicht (flur5.js); Decke nur noch über dem Flur-4-Absatzstreifen.
  roof(F.stairEnd,F.stairNorth,F.upperEnd,F.stairSouth,F.stairRoof,M.flur2Ceiling);
  wall([F.east,F.stairNorth],[F.stairEnd,F.stairNorth],[],{y0:4.9,top:F.stairRoof});
  wall([F.stairEnd,F.stairNorth],[F.stairEnd,-3.62],[],{y0:4.903,top:F.upper-.003});   // 3 mm über der Flur-2-Decke (sonst flackert sie), knapp unter dem Flur-4-Boden
  // Unter dem Lauf zu Flur 4 schließen: sonst blickt man von oben durch die Flur-2-Decke.
  const under=wall([F.stairEnd,-3.62],[F.stairEnd,F.stairSouth],[],{y0:4.903,top:F.upper-.003});
  map.walls.splice(map.walls.length-under.segments.length);   // liegt unter dem Absatz, nicht auf der OG-Karte
  wall([F.stairEnd-.003,F.stairSouth],[F.east,F.stairSouth],[],{y0:4.9,top:F.stairRoof});   // Ende 3 mm in der Flur-4-Wand
  // Zwischen Hallendecke und Flur-5-Boden (7,48 m) schließen: unter dem Austritt bis zur Laufuntersicht,
  // unter der Galerie 3 mm unter dem Galerieboden.
  wall([F.east,F.stairNorth],[F.east,-3.62],[],{y0:F.roof,top:F.upper+1.73});
  wall([F.east,-3.62],[F.east,F.stairSouth],[],{y0:F.roof,top:F.upper+1.927});
  // Lauf Flur 4 → Flur 5 (bisher nur Untersicht), seit Flur 5 begehbar.
  flight(F.upper+1.93,F.upper,F.stairNorth,-3.62,M.aluminium,'treppe_flur4_flur5');
  rail(F.east,F.stairEnd,-3.62,F.upper+1.93,F.upper);
  // Der fotografierte obere Absatz ist nun Flur 4 (5,55 m), kein Türverschluss.
  // Seine Hülle gehört flur4.js; vorhandene Treppe/Platte bleiben hier.
  // Dieselbe räumliche Hofanlage wie vor der EG-Tür; keine Bildebene vor dem Fenster.
  // Durchgehender Seitenhandlauf und Wegweiser am oberen Treppenbeginn.
  for(const [z,h0,h1]of[[F.stairNorth+.08,F.y,F.lower],[F.stairSouth-.08,F.y,F.upper]])
    b.rod(M.handrailWood,[F.east-.15,h0+.90,z],[F.stairEnd,h1+.90,z],.028,12);
  // Wandhandlauf am Lauf Flur 4 → Flur 5 (sciht von von flur 4 auf 5.jpg).
  b.rod(M.handrailWood,[F.east+.1,F.upper+1.93+.92,F.stairNorth+.07],[F.stairEnd-.1,F.upper+.92,F.stairNorth+.07],.028,12);
  for(const t of [.15,.5,.85]){const x=F.east+(F.stairEnd-F.east)*t,y=F.upper+1.93*(1-t)+.92;b.bar(M.aluminium,[x,y-.07,F.stairNorth+.002],[x,y-.01,F.stairNorth+.07],.015,.015);}
  acrylic(M.flur2WayUp,.66,.138,F.east+.42,Y+1.65,F.stairSouth-.018,Math.PI);   // auf der Treppenwand, nicht über der Ecke
  map.areas.push({poly:[[F.east,F.stairNorth],[F.stairEnd,F.stairNorth],[F.stairEnd,-3.62],[F.east,-3.62]],fill:'rgba(120,145,175,.35)'});
  map.labels.push({text:'↓ Flur 2',x:6.9,z:-5.1});

  // Leuchtengeometrie wird geteilt, nur vier Raumlichtquellen plus zwei Tageslichter.
  for(const x of [-3.65,-.65,2.65])for(const z of [-5.25,-1.65])addCeilingLight(fixtures,{...M,lightPanel:M.flur3Light},x,F.roof,z,{length:1.25,width:.15,ry:Math.PI/2});
  for(const z of [-7.9,-10.4])addCeilingLight(fixtures,{...M,lightPanel:M.flur3Light},-3.9,F.roof,z,{length:1.25,width:.13});
  for(const [x,y,z,power,distance]of[[-3.3,F.roof-.32,-4.25,15,7],[.25,F.roof-.32,-3.55,17,7],[3.9,F.roof-.32,-4.3,15,7],[7.5,7.5,-2.4,12,7]]){
    const l=new THREE.PointLight(0xfff4e5,power,distance,2);l.position.set(x,y,z);root.add(l);lights.push(l);
  }
  for(const x of [-3.6,-1.1])lighting.addDaylight(root,'licht_flur3',{position:[x,Y+2,F.south+.45],intensity:12,distance:8});
  const sb=new PartBuilder();addSwitchPlate(sb,M,0,0,0);const sw=sb.build({name:'lichtschalter_flur3'});
  sw.position.set(4.94,Y+1.04,F.north+.022);root.add(sw);registerObject('lichtschalter_flur3','switch','Flur 3: Licht',sw);
  interactions.register(sw,{id:'lichtschalter_flur3',type:'switch',label:()=>lighting.isOn('licht_flur3')?'Flur 3: Licht ausschalten':'Flur 3: Licht einschalten',onInteract:()=>{lighting.toggle('licht_flur3');audio.click();}});
  for(const x of [-3.1,.1,3.1]){fixtures.cylinder(M.switchWhite,.055,.055,.025,x,F.roof-.014,-3.45,12);fixtures.box(M.panelGrey,.20,.01,.20,x+.35,F.roof-.007,-3.45);}
  for(const [x,z]of[[-4.9,-5.5],[4.9,-3.4]]){
    for(const s of [-1,1])b.rod(M.aluminium,[x+s*.09,F.roof,z],[x+s*.09,F.roof-.3,z],.004,6);
    b.box(M.flur3Frame,.35,.18,.06,x,F.roof-.39,z);plane(M.foyerExit_left,.32,.15,x,F.roof-.39,z+.032);plane(M.foyerExit_right,.32,.15,x,F.roof-.39,z-.032,Math.PI);
  }
  lighting.addCircuit('licht_flur3',{lights,panels:[M.flur3Light],on:true,regions:[
    [F.west-.11,F.north-.11,F.east,F.south+.11,Y-.08,F.roof+.08],
    [F.west-.11,F.nicheZ-.11,F.nicheX+.11,F.north-.11,Y-.08,F.roof+.08],
    ...returnStairRegions(true),[F.east,-3.62,F.stairEnd,F.stairSouth,Y-.12,F.stairRoof]
  ]});
  lighting.portals.add({id:'flur2_flur3_treppe',rooms:['licht_flur2','licht_flur3'],normal:[-1,0],center:[F.stairEnd,3.38,-5.22],width:3.23,height:2.92,power:.25,range:4});
  root.add(walls.build({name:'flur3_waende'}),b.build({name:'flur3_ausstattung'}),fixtures.build({name:'flur3_leuchten',castShadow:false}));
  root.traverse(o=>{if(o.isMesh&&o.material===M.flur3Wall)metricBoxUV(o.geometry,.65);if(o.isMesh&&o.material===M.foyerPhotoStair)metricBoxUV(o.geometry,.48);});
  return {id:'flur_3',name:'Flur 3',root,mapFloor:1,bounds:{minX:F.west-.22,maxX:F.upperEnd+.22,minZ:F.nicheZ-.22,maxZ:F.south+.22,minY:F.lower,maxY:F.stairRoof},
    areaName(p){
      if(p.x>=F.stairEnd&&p.y>=F.upper-.12)return null;
      if(p.x>=F.east&&p.x<=F.stairEnd&&p.z>=F.stairNorth&&p.z<=-3.62&&p.y>F.lower+.03)return 'Treppe · Flur 2 ↔ Flur 3';
      if(p.x>=F.east&&p.x<=F.stairEnd&&p.z>=-3.62&&p.z<=F.stairSouth&&p.y>Y+.03&&p.y<F.upper-.03)return 'Treppe · Flur 3 ↔ Flur 4';
      if(p.y<Y-.12||p.y>(p.x>F.east?F.stairRoof:F.roof+.1)||p.x<F.west||p.x>F.upperEnd||p.z<F.nicheZ||p.z>F.south)return null;
      if(p.z<F.north&&p.x>F.nicheX)return null;
      return p.x>F.east?'Flur 3 · Treppenhaus':'Flur 3 · Aufenthaltsbereich';
    }};

  function rail(x0,x1,z,h0,h1){
    for(let i=0;i<=4;i++){const t=i/4;b.box(M.flur3Frame,.04,1.02,.04,x0+(x1-x0)*t,h0+(h1-h0)*t+.51,z);}
    for(let i=1;i<=5;i++)b.rod(i===3?M.redSteel:M.blueSteel,[x0,h0+i*.16,z],[x1,h1+i*.16,z],.007,8);
    b.rod(M.handrailWood,[x0-.07,h0+1.04,z],[x1+.02,h1+1.04,z],.028,12);
    C.add({x:(x0+x1)/2,z,w:.12,d:x1-x0,rot:Math.PI/2,bottom:Math.min(h0,h1),slope:{h0:h0+1.05,h1:h1+1.05},tag:'gelaender'});
  }
  function flight(h0,h1,z0,z1,nose,id,overhead=false){
    const a=F.east,d=F.stairEnd,n=F.steps,going=(d-a)/n,rise=(h1-h0)/n;
    for(let i=0;i<n;i++){
      const x=a+i*going,ya=h0+rise*i,yb=ya+rise,top=Math.max(ya,yb),edge=rise>0?x:x+going-.03;
      b.boxMinMax(M.foyerPhotoStair,x,top-Math.abs(rise)-.025,z0+.025,x+going,top,z1-.025);
      b.box(nose,.03,.005,z1-z0-.05,edge+.015,top+.003,(z0+z1)/2);
      if(!overhead)C.add({x:x+going/2,z:(z0+z1)/2,w:z1-z0,d:going,rot:Math.PI/2,bottom:Math.min(ya,yb)-.17,slope:{h0:ya,h1:yb},tag:'treppe',surface:'rubber',id});
      else C.addBox(x,z0,x+going,z1,Math.min(ya,yb)-.19,top,{tag:'decke'});
    }
    const shape=new THREE.Shape([new THREE.Vector2(a,h0-.20),new THREE.Vector2(d,h1-.20),new THREE.Vector2(d,h1-.025),new THREE.Vector2(a,h0-.025)]);
    const g=new THREE.ExtrudeGeometry(shape,{depth:z1-z0,bevelEnabled:false});g.translate(0,0,z0);b.add(M.ceilingPlain,g);
    anchor(id,'stairs',overhead?'Obere Treppenuntersicht':'Treppe',a,h0,(z0+z1)/2);
  }
  function cabinet(x,z){
    b.push(x,Y,z);const w=.88,d=.43,h=1.93;
    for(const sx of [-w/2,w/2])for(const sz of [-d/2,d/2])b.box(M.aluminium,.028,h,.028,sx,h/2+.06,sz);
    for(const y of [.13,.50,.88,1.26,1.64,1.98]){
      b.box(y===.13?M.flur3BlueSeat:M.flur3Glass,w-.04,.012,d-.04,0,y,0);
      for(const zz of [-d/2,d/2])b.box(M.aluminium,w,.018,.024,0,y,zz);
    }
    for(const sz of [-d/2,d/2])b.box(M.flur3Glass,w-.03,1.83,.004,0,1.06,sz);
    for(const sx of [-w/2,w/2])b.box(M.flur3Glass,.004,1.83,d-.03,sx,1.06,0);
    for(let i=0;i<16;i++){const yy=.14+Math.floor(i/4)*.38,xx=-.30+(i%4)*.20;b.box([M.flur3BlueSeat,M.flur3OliveSeat,M.flur2Red,M.paper][i%4],.12,.14+(i%3)*.035,.035,xx,yy+.10,.02,0,(i%3-.8)*.2);}
    b.pop();C.addBox(x-.46,z-.24,x+.46,z+.24,Y,Y+2.02,{tag:'vitrine'});anchor('flur3_vitrine','decoration','Glasvitrine',x,Y,z);
  }
  function plant(x,z){
    b.cylinder(M.flur3Pot,.34,.25,.46,x,Y+.25,z,28);b.cylinder(M.flur3Pot,.38,.38,.045,x,Y+.035,z,28);b.cylinder(M.flur3Soil,.315,.315,.012,x,Y+.485,z,24);
    b.rod(M.flur3Bark,[x,Y+.44,z],[x+.08,Y+1.95,z+.03],.035,12);
    const geometry=new THREE.PlaneGeometry(.14,.27),leaves=new THREE.InstancedMesh(geometry,M.flur3Leaf,650);
    let seed=78;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let j=0;j<12;j++){
      const a=j*2.4,yy=Y+1.2+(j%4)*.26;
      b.rod(M.flur3Bark,[x+.04,yy-.3,z],[x+Math.cos(a)*.65,yy+.2,z+Math.sin(a)*.55],.012,7);
    }
    for(let i=0;i<650;i++){
      const a=rnd()*Math.PI*2,v=rnd()*2-1,r=Math.sqrt(1-v*v)*Math.pow(rnd(),.3),sz=.6+rnd()*.65;
      leaves.setMatrixAt(i,matrixFrom(x+Math.cos(a)*r*.82,Y+1.92+v*.81,z+Math.sin(a)*r*.72,rnd()*2-1,a,rnd()-.5,sz,sz,sz));
    }
    leaves.instanceMatrix.needsUpdate=true;leaves.castShadow=true;leaves.receiveShadow=true;root.add(leaves);
    C.addBox(x-.36,z-.36,x+.36,z+.36,Y,Y+.5,{tag:'pflanze'});anchor('flur3_baum','decoration','Baum am Fenster',x,Y,z);
  }
}

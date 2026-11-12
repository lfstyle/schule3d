// Flur 2, Fotoabgleich vom 15.10.2026. Maße geschätzt; siehe docs/PLANUNG.md.
// Höhenlage +1,53 m über dem Foyer; der Außeneingang liegt bei -0,45 m.
import * as THREE from 'three';
import { PartBuilder, matrixFrom, metricBoxUV } from '../geometry.js';
import { addWall, Door, addWindow, addSwitchPlate, addUtilityCabinet,
  addCeilingLight, addFramedPicture, addTrashBin } from '../objects.js';
import { FOYER } from './flur.js';
import { addServerRack, addCableTray, addWallAC } from '../server-objects.js';
import { Toggle } from '../animated.js';

export const FLUR2={west:FOYER.stairX1,east:12.22,nicheWest:9.25,
  north:-9.65,south:2.6,y:FOYER.up.top,roof:FOYER.stairCeiling,
  exit:{north:-6.45,south:-3.65,stairEnd:15.58,east:17.98,y:-0.45,steps:12}};

export function buildFlur2(ctx){
  const {scene,collision:C,materials:M,registerObject,interactions,lighting,audio,map}=ctx;
  const F=FLUR2,E=F.exit,Y=F.y,H=F.roof-Y;
  const root=new THREE.Group();root.name='flur_2';scene.add(root);
  const walls=new PartBuilder(),stat=new PartBuilder(),fixtures=new PartBuilder(),lights=[],updates=[];
  // Beide DV-Türen öffnen laut Fotos in den Flur, mit entgegengesetzten Bandseiten.
  // Kollision und Lichtöffnung folgen dem jeweiligen Türblatt.
  // Raum 132 (Computer-Serverraum) zwischen Aufenthaltsraum und 131, Lage/Tiefe nach Rettungsplan.
  // Keine Fotos des Raums: Grundriss nach Plan, Einrichtung nach Beispielbildern. Südwand innen vor der Hoffassade (aussenbereich.js).
  // Nutzerkorrektur 17.10. (fotos/fix): so schmal wie der Flur davor, zu Aufenthaltsraum und 131 dicke Mauern;
  // vorher reichte 132 bis an den Aufenthaltsraum und man sah durch dessen rotes Emporenfenster.
  const R132={x0:F.west,x1:11.7,z0:2.8,z1:9.17,window:10.0};
  function build132(){
    const R=R132;
    surface(M.flur2Floor,R.x0,2.6,R.x1,R.z0,Y);surface(M.serverFloor,R.x0,R.z0,R.x1,R.z1,Y,false,.6);
    C.addBox(R.x0,2.6,R.x1,R.z1,Y-.18,Y,{tag:'boden'});
    ceiling(R.x0,R.z0,R.x1,R.z1);   // mit schattenwerfender Dachfläche, sonst scheint die Sonne durch
    // Mauerkerne bis zur Dachfläche: West zum Aufenthaltsraum (Außenkante x = 7,3), Ost bis zur 131-Westwand
    // (x 12,22–12,42, endet bei z = 6,15, danach eigener Wandstreifen bis zur Fassade).
    for(const [x0,z0,x1] of [[7.3,2.6,R.x0],[R.x1,R.z0,F.east-.001]]){
      walls.boxMinMax(M.flur2Wall,x0,Y,z0,x1,F.roof+.17,R.z1);C.addBox(x0,z0,x1,R.z1,Y,F.roof,{tag:'wand'});
    }
    map.walls.push([R.x0,R.z0,R.x0,R.z1],[R.x1,R.z0,R.x1,R.z1]);
    walls.boxMinMax(M.flur2Wall,F.east,Y,6.13,F.east+.2,F.roof,R.z1);C.addBox(F.east,6.13,F.east+.2,R.z1,Y,F.roof,{tag:'wand'});
    // Innenseite der Südwand mit der einen Fensterachse der Hoffassade (Plan und Außenfoto)
    const sw=addWall(walls,M,{start:[R.x1,R.z1],end:[R.x0,R.z1],y0:Y,height:F.roof-Y,thickness:.01,material:M.flur2Wall,baseboard:false,
      openings:[{u:R.x1-R.window-.575,w:1.15,y:2.12-Y,h:1.7}]});
    map.walls.push(...sw.segments);
    lighting.portals.add({id:'r132_fenster',rooms:['licht_132','licht_hof'],normal:[0,1],center:[R.window,2.97,R.z1+.12],width:1.1,height:1.65,transmission:.6,range:4});
    // Einrichtung nach zwei Beispielbildern des Nutzers (17.10.), keine Fotos des echten Raums:
    // zwei Reihen 42-HE-Schränke mit LED-Fronten, Mittelgang auf die Fensterachse, Kabelrinnen darüber.
    // Westreihe ab der Nordwand, Ostreihe erst hinter dem Eingang (Tür x 10,15–11,25, Lichtschalter).
    const rack={w:.6,d:.9,h:2.0},rows=[
      {side:'w',x:R.x0+.05+rack.d/2,ry:Math.PI/2,z0:3.1,variants:[0,1,2,0,2,1,0,2,0,1]},
      {side:'o',x:R.x1-.05-rack.d/2,ry:-Math.PI/2,z0:4.3,variants:[2,0,1,2,0,0,1,2]},
    ];
    for(const row of rows){
      const z1=row.z0+row.variants.length*rack.w,front=row.x+Math.sin(row.ry)*(rack.d/2+.03);
      row.variants.forEach((variant,i)=>{
        const z=row.z0+(i+.5)*rack.w;
        stat.push(row.x,Y,z,row.ry);addServerRack(stat,M,{variant,...rack});stat.pop();
        anchor(`server_132_${row.side}${i+1}`,'server',`Serverschrank ${row.side.toUpperCase()}${i+1}`,row.x,Y,z);
        if(i%3===1)stat.rod(M.serverCableBlue,[row.x+.12,Y+2.3,z],[row.x+.12,Y+rack.h,z],.018,8);   // Zuleitung aus der Rinne
      });
      // Hellere Seitenwand mit Reihenschild am Nordende (vom Eingang sichtbar), schlichte am Südende.
      stat.box(M.serverRackSide,rack.d,rack.h-.06,.012,row.x,Y+.06+(rack.h-.06)/2,row.z0-.006);
      stat.box(M.serverRackSide,rack.d,rack.h-.06,.012,row.x,Y+.06+(rack.h-.06)/2,z1+.006);
      plane(M[row.side==='w'?'serverRowA':'serverRowB'],.3,.11,row.x,Y+1.75,row.z0-.0135,Math.PI);
      const [x0,x1]=[row.x,front].sort((a,b)=>a-b),xw=row.ry>0?R.x0:R.x1;
      C.addBox(Math.min(x0,xw),row.z0-.012,Math.max(x1,xw),z1+.012,Y,Y+rack.h,{tag:'schrank',id:'server_132_reihe_'+row.side});
      map.furniture.push([Math.min(front,xw),row.z0-.012,Math.max(front,xw),z1+.012]);
      stat.push(row.x,Y+2.3,(row.z0+z1)/2);addCableTray(stat,M,{length:z1-row.z0,ceiling:F.roof-Y-2.3});stat.pop();
      // Blauer Schein vor der Front: gleiches Verlaufsbild, auf der Ostseite gespiegelt.
      const glow=new THREE.PlaneGeometry(Math.abs(10.0-front),z1-row.z0);glow.rotateX(-Math.PI/2);
      if(row.ry<0){const uv=glow.attributes.uv;for(let k=0;k<uv.count;k++)uv.setX(k,1-uv.getX(k));}
      fixtures.add(M.serverGlow,glow,matrixFrom((front+10.0)/2,Y+.003,(row.z0+z1)/2));
    }
    // Querrinne über dem Gang am Fensterende, etwas höher als die Längsrinnen.
    stat.push(10.0,Y+2.38,8.8,Math.PI/2);addCableTray(stat,M,{length:2.4,ceiling:F.roof-Y-2.38});stat.pop();
    stat.push(R.x1,Y+2.7,3.55,-Math.PI/2);addWallAC(stat,M);stat.pop();
    anchor('klima_132','decoration','132: Klimagerät',R.x1,Y+2.7,3.55);
    // Hörbereich der Serverschränke (spatial-ambience.js): draußen nur bei offener Tür.
    anchor('raum_132','room','132 · Computer-Serverraum',(R.x0+R.x1)/2,Y,(R.z0+R.z1)/2).userData.zone=[R.x0,2.6,R.x1,R.z1];
    updates.push({update:dt=>{M.serverTime.value=(M.serverTime.value+dt)%3600;}});
    // Deckenleuchten über dem Gang, eigener Lichtkreis, Schalter innen neben der Tür
    const panel=M.flur2Light.clone(),lx=10.0;
    for(const z of [4.0,6.1,8.2])addCeilingLight(fixtures,{...M,lightPanel:panel},lx,F.roof,z,{length:1.22,width:.17,ry:Math.PI/2});
    const l=new THREE.PointLight(0xfff6e8,9,7,2);l.position.set(lx,F.roof-.35,6.1);root.add(l);
    lighting.addCircuit('licht_132',{lights:[l],panels:[panel],on:true,regions:[[R.x0-.1,2.6,R.x1+.1,R.z1+.1,1.44,F.roof+.08]]});
    // Schwaches blaues Licht der LED-Fronten, immer an und ohne warme Grundaufhellung,
    // damit der Raum bei ausgeschaltetem Licht nicht schwarz bis auf die Fronten ist.
    const led=new THREE.PointLight(0x2f6dff,2.2,6,2);led.position.set(10.0,Y+1.1,6.2);root.add(led);
    lighting.addCircuit('licht_132_led',{lights:[led],alwaysOn:true,bounce:0,regions:[[R.x0-.1,R.z0,R.x1+.1,R.z1+.1,1.44,F.roof+.08]]});
    const sb=new PartBuilder();addSwitchPlate(sb,M,0,0,0);
    const sw2=sb.build({name:'lichtschalter_132'});sw2.position.set(11.48,Y+1.12,R.z0+.012);root.add(sw2);
    interactions.register(sw2,{id:'lichtschalter_132',type:'switch',label:()=>lighting.isOn('licht_132')?'132: Licht ausschalten':'132: Licht einschalten',onInteract:()=>{lighting.toggle('licht_132');audio.click();}});
    registerObject('lichtschalter_132','switch','132: Licht',sw2);
    map.areas.push({poly:[[R.x0,R.z0],[R.x1,R.z0],[R.x1,R.z1],[R.x0,R.z1]],fill:'rgba(145,172,184,0.14)'});
    map.labels.push({text:'132 Server',x:(R.x0+R.x1)/2,z:(R.z0+R.z1)/2});
  }
  const openableDoor=(door,d,id,label)=>{
    const leafCollider=C.add({x:d.x,z:d.z,w:1.01,d:0.065,rot:d.ry,bottom:Y,top:Y+2.19,tag:'tuer',id});
    const leafPoint=new THREE.Vector3();
    const toggle=new Toggle({duration:0.8,apply:k=>{
      door.pivot.rotation.y=(d.hinge==='left'?-1.6:1.6)*k;door.group.updateMatrixWorld(true);door.leaf.getWorldPosition(leafPoint);
      C.update(leafCollider,{x:leafPoint.x,z:leafPoint.z,rot:d.ry+door.pivot.rotation.y});
    }});
    updates.push(toggle);door.group.userData.toggle=toggle;
    registerObject(id,'door',label,door.group);
    interactions.register(door.group,{id,type:'door',label:()=>`Raum ${d.n} ${toggle.isOpen?'schließen':'öffnen'}`,onInteract:()=>audio.door(toggle.toggle())});
    // Normale vom Flur in den Raum aus der Türdrehung: 130/131 Ostwand (+x), 132 Südwand (+z).
    // Vorher fest [1,0] – bei 132 fiel das Licht dadurch quer und versetzt in den Flur.
    lighting.portals.add({id,rooms:['licht_flur2','licht_'+d.n],normal:[Math.round(-Math.sin(d.ry)),Math.round(-Math.cos(d.ry))],center:[d.x,Y+1.095,d.z],width:1.02,height:2.19,hinge:d.hinge==='left'?1:-1,
      opening:()=>1-Math.cos(Math.min(Math.abs(door.pivot.rotation.y),Math.PI/2))});
  };
  const anchor=(id,type,name,x,y,z)=>{
    const o=new THREE.Object3D();o.position.set(x,y,z);root.add(o);registerObject(id,type,name,o);return o;
  };
  const plane=(mat,w,h,x,y,z,ry=0)=>stat.add(mat,new THREE.PlaneGeometry(w,h),matrixFrom(x,y,z,0,ry));
  const wall=(a,b,openings=[],{y0=Y,height=H,dado=true}={})=>{
    const r=addWall(walls,M,{start:a,end:b,openings,height,y0,thickness:0.2,material:M.flur2Wall,baseboard:false});
    r.colliders.forEach(c=>C.add({...c,tag:'wand'}));map.walls.push(...r.segments);
    if(dado){
      stat.push(a[0],y0,a[1],r.rot);let u0=0;
      for(const d of [...openings.filter(o=>o.y<0.05).sort((a,b)=>a.u-b.u),{u:r.length,w:0}]){
        if(d.u>u0){
          stat.box(M.flur2Dado,d.u-u0,0.95,0.014,(d.u+u0)/2,0.475,0.008);
          stat.box(M.flur1Skirting,d.u-u0,0.085,0.024,(d.u+u0)/2,0.0425,0.016);
        }
        u0=d.u+d.w;
      }stat.pop();
    }return r;
  };
  const surface=(mat,x0,z0,x1,z1,y,down=false,tile=1)=>{
    const geo=new THREE.PlaneGeometry(x1-x0,z1-z0);geo.rotateX(down?Math.PI/2:-Math.PI/2);
    const p=geo.attributes.position,uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(p.getX(i)+(x0+x1)/2)/tile,(p.getZ(i)+(z0+z1)/2)/tile);
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set((x0+x1)/2,y,(z0+z1)/2);mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const floor=(x0,z0,x1,z1,y=Y)=>{
    surface(M.flur2Floor,x0,z0,x1,z1,y);C.addBox(x0,z0,x1,z1,y-0.18,y,{tag:'boden'});
  };
  const ceiling=(x0,z0,x1,z1,red=false)=>{
    surface(red?M.foyerCeiling:M.flur2Ceiling,x0,z0,x1,z1,F.roof,true,red?5:0.6);
    surface(M.foyerRoof,x0,z0,x1,z1,F.roof+0.17).castShadow=true;
    C.addBox(x0,z0,x1,z1,F.roof,F.roof+0.18,{tag:'decke'});
  };
  const framed=(mat,w,h,x,y,z,ry=0,frame=M.frameWhite)=>{
    stat.push(x,y,z,ry);addFramedPicture(stat,M,mat,w,h,frame);stat.pop();
  };
  const acrylic=(mat,w,h,x,y,z,ry=0)=>{
    stat.push(x,y,z,ry);plane(mat,w,h,0,0,0.027);
    for(const sx of [-w/2+0.018,w/2-0.018])for(const sy of [-h/2+0.018,h/2-0.018])
      stat.cylinder(M.chrome,0.008,0.008,0.014,sx,sy,0.026,8,Math.PI/2);
    stat.pop();
  };

  // Zusammenhängende T-Form: zwei Raumnischen am Querpodest und die Außentreppe.
  floor(F.west,FOYER.down.z0,F.east,FOYER.up.z1);
  floor(F.nicheWest,F.north,F.east,FOYER.down.z0);
  floor(F.west,FOYER.up.z1,F.east,F.south);
  ceiling(F.west,FOYER.down.z0,F.east,FOYER.up.z1,true);
  ceiling(F.nicheWest,F.north,F.east,FOYER.down.z0,true);
  ceiling(F.west,FOYER.up.z1,F.east,F.south,true);
  ceiling(F.east,E.north,E.east,E.south);
  // Flacher Revisionsdeckel im Linoleum, IMG_4636.
  for(const s of [-1,1]){
    stat.box(M.flur1Skirting,.68,.0015,.003,10.55,Y+.001,-3.0+s*.34);
    stat.box(M.flur1Skirting,.003,.0015,.68,10.55+s*.34,Y+.001,-3.0);
  }
  const ow=1.10,oh=2.25;
  const opening=u=>({u,w:ow,y:0,h:oh});
  wall([F.nicheWest,F.north],[F.east,F.north],[opening(10.70-F.nicheWest-ow/2)]);
  // Wandenden 3 mm in den Foyerwänden, nicht in deren Fläche (sonst flackert die Ecke).
  wall([F.nicheWest,FOYER.down.z0-0.003],[F.nicheWest,F.north]);
  // Ostwand hat eine echte Öffnung zur Außentreppe, keine Wand hinter dem Durchgang.
  wall([F.east,F.north],[F.east,E.north],[opening(-8.25-F.north-ow/2)]);
  wall([F.east,E.south],[F.east,F.south],[opening(-1.8-E.south-ow/2)]);
  wall([F.east,F.south],[F.west,F.south],[opening(F.east-10.70-ow/2)]);
  wall([F.west,F.south],[F.west,FOYER.up.z1+0.003]);

  for(const d of [
    {n:129,x:10.70,z:F.north,ry:0,hinge:'left'},
    {n:130,x:F.east,z:-8.25,ry:-Math.PI/2,hinge:'left'},
    {n:131,x:F.east,z:-1.8,ry:-Math.PI/2,hinge:'right'},
    {n:132,x:10.70,z:F.south,ry:Math.PI,hinge:'right',server:true},
  ]){
    const id='flur2_'+d.n,label=d.server?'132 · Computer-Serverraum':d.n+' · Daten-Verarbeitung';
    const open=d.n===130||d.n===131||d.n===132;   // 132: Serverraum, siehe build132
    const door=new Door(M,{id,width:1.02,openingWidth:ow,openingHeight:oh,leafHeight:2.19,transom:false,
      frontMaterial:M.flur1Wood,backMaterial:M.flur1Wood,leafMaterial:M.flur1Wood,casingBack:open,
      frameMaterial:d.server?M.flur2ExitMetal:M.flur2Red,wallThickness:0.2,hinge:d.hinge,knob:d.server});
    door.group.position.set(d.x,Y,d.z);door.group.rotation.y=d.ry;root.add(door.group);
    if(open)openableDoor(door,d,id,label);
    else{
      C.add({x:d.x,z:d.z,w:ow,d:0.21,rot:d.ry,bottom:Y,top:Y+oh,tag:'tuer',id});
      registerObject(id,'door',label+' · geschlossen',door.group);
    }
    // Raumschild auf dem Mauerwerk neben der Tür; die Holzblätter bleiben eigenständig.
    const side=d.n===131?-0.79:0.79;
    acrylic(M['flur2Room'+d.n],0.22,0.193,d.x+Math.cos(d.ry)*side,Y+1.66,d.z-Math.sin(d.ry)*side,d.ry);
    stat.push(d.x,Y,d.z,d.ry);
    if(d.n===131){
      // Am offenen Blatt von 131 hängt laut Foto nur ein Aushang; er schwingt mit der Tür.
      const note=new THREE.Mesh(new THREE.PlaneGeometry(0.21,0.3),M.paper);note.position.set(0,0.45,0.024);note.userData.interactionId=id;door.leaf.add(note);   // nach dem Anmelden angehängt: ID selbst setzen
    }else if(d.server){
      // Aufkleber klebt am Türblatt und schwingt mit (Blattmitte y = 1,095, Vorderseite z = +0,0225).
      const sticker=new THREE.Mesh(new THREE.PlaneGeometry(0.10,0.13),M.flur2CameraWarning);
      sticker.position.set(0.38,1.98-1.095,0.0245);sticker.userData.interactionId=id;door.leaf.add(sticker);
    }else{
      plane(M.fireSign,0.13,0.16,0.38,2.02,0.04);
      plane(M.flur2CameraWarning,0.10,0.13,0.38,1.84,0.04);
    }
    if(d.server)addSwitchPlate(stat,M,side,1.12,0.02);
    stat.pop();
  }

  // IMG_4636 / raum4 / Nutzerfotos 17.10.: Korkwand beginnt direkt am Pfeiler, Monitor über ihrer linken Hälfte.
  framed(M.foyerCork,1.90,0.92,F.nicheWest+0.025,Y+1.38,-8.00,Math.PI/2,M.aluminium);
  plane(M.flur2Poster,0.31,0.44,F.nicheWest+0.067,Y+1.4,-7.65,Math.PI/2);
  // Kleine Anzeigetafel links neben dem Monitor.
  stat.push(F.nicheWest+0.03,Y+2.33,-7.17,Math.PI/2);
  stat.box(M.steel,0.24,0.32,0.05,0,0,0);stat.box(M.steelBlack,0.19,0.20,0.004,0,-0.02,0.027);stat.pop();
  stat.push(F.nicheWest+0.16,Y+2.35,-7.80,Math.PI/2);
  stat.box(M.steelBlack,0.85,0.5,0.07,0,0,0,0.10);
  stat.box(M.podcastScreen,0.80,0.447,0.006,0,-0.003,0.038,0.10);
  stat.box(M.steel,0.16,0.14,0.2,0,0,-0.10);stat.pop();
  anchor('flur2_monitor','decoration','Monitor über der Pinnwand',F.nicheWest+0.16,Y+2.35,-7.80);
  anchor('flur2_pinnwand','decoration','Pinnwand bei Raum 129',F.nicheWest,Y+1.38,-8.00);
  // IMG_4645 hat Vorrang vor schild.jpg: aktuelle Schulleitung, kein alter Spender.
  acrylic(M.flur2Directory,1.05,0.79,12.87,Y+1.50,E.north+0.026);
  // Nutzerfotos 17.10.: Wandpfeiler zwischen Treppe und 129er-Nische steht 20 cm vor,
  // der Wegweiser hängt links daneben an der Treppenwand über den obersten Stufen.
  const pz=FOYER.down.z0+0.20;
  stat.boxMinMax(M.flur2Wall,F.west,Y,FOYER.down.z0,F.nicheWest,F.roof,pz);
  C.addBox(F.west,FOYER.down.z0,F.nicheWest,pz,Y,F.roof,{tag:'wand',id:'flur2_pfeiler'});
  map.walls.push([F.west,pz,F.nicheWest,pz],[F.west,FOYER.down.z0,F.west,pz]);
  stat.box(M.flur2Dado,F.nicheWest-F.west,0.95,0.014,(F.west+F.nicheWest)/2,Y+0.475,pz+0.008);
  stat.box(M.flur2Dado,0.014,0.95,0.20,F.west-0.008,Y+0.475,FOYER.down.z0+0.10);
  acrylic(M.flur2WayUp,0.63,0.132,7.80,Y+1.90,FOYER.down.z0,0);
  acrylic(M.flur2WayDown,0.60,0.10,F.west+0.025,Y+2.32,-0.60,Math.PI/2);

  // Vier cremefarbene Schranktüren und Ordner: IMG_4639–4641. Schirm und Tasche auf Nutzerwunsch (17.10.) entfernt.
  for(const [i,z] of [[0,0.42],[1,1.50]]){
    stat.push(F.east-0.025,Y,z,-Math.PI/2);
    addUtilityCabinet(stat,M,{width:1.06,height:2.27,depth:0.48,material:M.switchWhite});
    for(let j=0;j<5;j++){
      const x=-0.41+j*0.18;
      stat.box(j%3?M.steelBlack:M.labBlue,0.075,0.31,0.24,x,2.43,0.24);
      stat.box(M.paper,0.044,0.11,0.004,x,2.46,0.365);
      stat.cylinder(M.chrome,0.012,0.012,0.006,x,2.34,0.367,8,Math.PI/2);
    }stat.pop();
    C.addBox(F.east-0.53,z-0.53,F.east,z+0.53,Y,Y+2.3,{tag:'schrank',id:'flur2_schrank_'+i});
    map.furniture.push([F.east-0.53,z-0.53,F.east,z+0.53]);
  }
  anchor('flur2_schraenke','cabinet','Schränke bei 131/132',F.east-0.5,Y,0.96);

  // Unterputz-Feuerlöschschrank auf der gegenüberliegenden Wand (IMG_4642).
  stat.push(F.west+0.025,Y+1.39,1.32,Math.PI/2);
  stat.box(M.flur2ExitMetal,1.02,1.03,0.026,0,0,0.013);
  stat.box(M.flur1Dado,0.62,0.97,0.014,-0.17,0,0.035);
  stat.box(M.flur1Dado,0.32,0.97,0.014,0.32,0,0.035);
  for(const x of [0.09,0.23])stat.cylinder(M.black,0.036,0.036,0.016,x,-0.015,0.05,12,Math.PI/2);
  stat.box(M.red,0.14,0.14,0.05,0.30,0.34,0.065);
  plane(M.fireAlarmFace,0.12,0.12,0.30,0.34,0.094);
  plane(M.fireSign,0.20,0.24,0.30,0.12,0.05);stat.pop();
  anchor('flur2_feuerloeschschrank','decoration','Feuerlöschschrank',F.west,Y+1.39,1.32);
  framed(M.flur2Plan,0.65,0.49,F.east-0.028,Y+1.72,-3.04,-Math.PI/2,M.aluminium);
  stat.push(F.east-0.035,Y+1.46,-2.57,-Math.PI/2);
  stat.box(M.red,0.13,0.13,0.035,0,0,0.02);plane(M.flur2Smoke,0.11,0.11,0,0,0.041);stat.pop();
  addSwitchPlate(stat,M,F.east-0.028,Y+1.12,-2.55,-Math.PI/2);

  buildExit();
  build132();
  // Eigener Stromkreis; vier sparsame, schattenlose Lichtquellen statt einer je Platte.
  for(const [x,z] of [[10.65,-8.1],[10.35,-3.9],[10.40,0.65],[14.75,-5.05]]){
    const l=new THREE.PointLight(0xfff6e8,10,6.3,2);l.position.set(x,F.roof-0.32,z);root.add(l);lights.push(l);
  }
  fixtures.box(M.aluminium,.18,.022,F.south-F.north,10.55,F.roof-.014,(F.north+F.south)/2);
  for(const z of [-8.25,-1.95,1.0])addCeilingLight(fixtures,{...M,lightPanel:M.flur2Light},10.55,F.roof,z,{length:1.22,width:0.17});
  for(const [i,x] of [12.95,14.15,15.35,16.55].entries()){
    fixtures.box(M.flur2ExitMetal,0.60,0.028,0.60,x,F.roof-0.015,-5.05+(i%2?0.48:-0.48));
    fixtures.box(M.flur2Light,0.56,0.006,0.56,x,F.roof-0.032,-5.05+(i%2?0.48:-0.48));
  }
  addCeilingLight(fixtures,{...M,lightPanel:M.flur2Light},9.7,F.roof,-4.85,{length:1.2,width:0.15,ry:Math.PI/2});
  for(const z of [-7.1,-2.4]){
    fixtures.cylinder(M.switchWhite,0.06,0.06,0.03,10.0,F.roof-0.017,z,16);
    fixtures.box(M.panelGrey,0.24,0.012,0.24,10.6,F.roof-0.008,z);
  }
  const sb=new PartBuilder();addSwitchPlate(sb,M,0,0,0);
  const sw=sb.build({name:'lichtschalter_flur2'});sw.position.set(F.west+0.025,Y+1.12,-0.48);sw.rotation.y=Math.PI/2;root.add(sw);
  interactions.register(sw,{id:'lichtschalter_flur2',type:'switch',label:()=>lighting.isOn('licht_flur2')?'Flur 2: Licht ausschalten':'Flur 2: Licht einschalten',onInteract:()=>{lighting.toggle('licht_flur2');audio.click();}});
  registerObject('lichtschalter_flur2','switch','Flur 2: Licht',sw);
  lighting.addCircuit('licht_flur2',{lights,panels:[M.flur2Light],on:true,regions:[
    [F.west,FOYER.down.z0,F.east,FOYER.up.z1,1.44,F.roof+.08],
    [F.nicheWest-0.1,F.north-0.1,F.east+0.1,FOYER.down.z0,1.44,F.roof+.08],
    [F.west-0.1,FOYER.up.z1,F.east+0.1,F.south+0.1,1.44,F.roof+.08],
    [F.east,E.north-0.1,E.east+0.1,E.south+0.1,-1,F.roof+.08],
  ]});
  lighting.addDaylight(root,'licht_flur2',{position:[E.east+0.55,3.7,-5.05],intensity:15,distance:8});
  lighting.portals.add({id:'foyer_flur2_treppe',rooms:['licht_flur','licht_flur2'],normal:[1,0],
    center:[F.west,3.1,(FOYER.up.z0+FOYER.up.z1)/2],width:2.6,height:3.2,power:0.25,range:4});
  root.add(walls.build({name:'flur2_waende'}),stat.build({name:'flur2_ausstattung'}),fixtures.build({name:'flur2_leuchten',castShadow:false}));
  root.traverse(o=>{if(o.isMesh&&o.material===M.flur2Wall)metricBoxUV(o.geometry,0.65);if(o.isMesh&&o.material===M.foyerPhotoStair)metricBoxUV(o.geometry,0.48);});
  const poly=[[F.west,FOYER.down.z0],[F.nicheWest,FOYER.down.z0],[F.nicheWest,F.north],[F.east,F.north],
    [F.east,E.north],[E.east,E.north],[E.east,E.south],[F.east,E.south],[F.east,F.south],[F.west,F.south]];
  map.areas.push({poly,fill:'rgba(145,172,184,0.18)'});map.labels.push({text:'Flur 2',x:10.2,z:-4.1},{text:'↓ Ausgang',x:14.2,z:-5.05});
  return {id:'flur_2',name:'Flur 2',root,
    // Startpunkt unten am Außeneingang, Blick die Treppe hinauf Richtung Flur 3.
    spawn:{x:E.east-.7,y:E.y,z:(E.north+E.south)/2,yaw:Math.PI/2,pitch:.12},bounds:{minX:F.west,maxX:E.east+0.2,minZ:F.north-0.2,maxZ:F.south+0.2,maxY:F.roof},
    update(dt){for(const u of updates)u.update(dt);},
    areaName(p){
      if(p.y>1.4&&p.x>=R132.x0&&p.x<=R132.x1&&p.z>=R132.z0&&p.z<=R132.z1)return '132 · Computer-Serverraum';
      if(p.y<=F.roof&&p.x>=F.east&&p.x<=E.east&&p.z>=E.north&&p.z<=E.south)return 'Flur 2 · Außeneingang';
      if(p.y<1.4||p.y>F.roof||p.x<F.west||p.x>F.east||p.z<F.north||p.z>F.south||p.z<FOYER.down.z0&&p.x<F.nicheWest)return null;
      return 'Flur 2 · Räume 129–132';
    }};

  function buildExit(){
    // Zwölf Stufen; durchgehende schräge Kollision verhindert Stolpern an jeder Setzstufe.
    const dz=E.south-E.north,cz=(E.north+E.south)/2,going=(E.stairEnd-F.east)/E.steps,rise=(Y-E.y)/E.steps;
    for(let i=0;i<E.steps;i++){
      const x=F.east+i*going,top=Y-i*rise;
      stat.box(M.foyerPhotoStair,going,rise+0.03,dz,x+going/2,top-(rise+0.03)/2,cz);
      stat.box(M.stairYellow,0.035,0.004,dz-0.03,x+going-0.018,top+0.003,cz);
      stat.box(M.stairYellow,0.004,0.04,dz-0.03,x+going+0.002,top-0.019,cz);
      C.add({x:x+going/2,z:cz,w:dz,d:going,rot:Math.PI/2,bottom:top-rise-0.19,slope:{h0:top,h1:top-rise},tag:'treppe',surface:'rubber',id:'flur2_aussentreppe'});
    }
    const shape=new THREE.Shape([new THREE.Vector2(F.east,Y-.22),new THREE.Vector2(E.stairEnd,E.y-.22),new THREE.Vector2(E.stairEnd,E.y),new THREE.Vector2(F.east,Y)]);
    const slab=new THREE.ExtrudeGeometry(shape,{depth:dz,bevelEnabled:false});slab.translate(0,0,E.north);stat.add(M.flur2Wall,slab);
    floor(E.stairEnd,E.north,E.east,E.south,E.y);
    // Seitenwände folgen unten der Treppe, der graue Anstrich steigt parallel zum Handlauf.
    wall([F.east,E.north],[E.east,E.north],[],{y0:E.y,height:F.roof-E.y,dado:false});
    wall([E.east,E.south],[F.east,E.south],[],{y0:E.y,height:F.roof-E.y,dado:false});
    for(const [z,flip] of [[E.north+0.012,false],[E.south-0.012,true]]){
      const sh=new THREE.Shape([new THREE.Vector2(F.east,Y-.2),new THREE.Vector2(E.stairEnd,E.y-.2),new THREE.Vector2(E.east,E.y-.2),new THREE.Vector2(E.east,E.y+.95),new THREE.Vector2(E.stairEnd,E.y+.95),new THREE.Vector2(F.east,Y+.95)]);
      const g=new THREE.ShapeGeometry(sh);if(flip){g.scale(1,1,-1);const ix=g.index;for(let j=0;j<ix.count;j+=3){const v=ix.getX(j);ix.setX(j,ix.getX(j+2));ix.setX(j+2,v);}g.computeVertexNormals();}g.translate(0,0,z);stat.add(M.flur2Dado,g);
      const inward=flip?-0.08:0.08;
      stat.rod(M.handrailWood,[F.east-0.08,Y+.92,z+inward],[E.stairEnd+.22,E.y+.92,z+inward],0.029,12);
      for(let j=0;j<5;j++){
        const t=j/4,x=F.east+t*(E.stairEnd-F.east),h=Y+(E.y-Y)*t+.88;
        stat.rod(M.flur2ExitMetal,[x,h,z+inward],[x,h-.07,z],0.014,8);
      }
    }
    // Abschluss mit zweiflügeliger grauer Ausgangstür und rotem Oberlicht. Die Flügel öffnen mit E nach außen
    // (Fluchtweg) auf den Vorplatz (rooms/vorplatz.js); Zarge, Seitenteile und Oberlicht bleiben fest.
    stat.push(E.east,E.y,cz,-Math.PI/2);
    const ew=dz,LH=2.19;
    for(const u of [-ew/2,-1.10,1.10,ew/2])stat.box(M.flur2ExitMetal,0.06,2.25,0.14,u,1.125,0);
    for(const y of [0.03,2.25])stat.box(M.flur2ExitMetal,ew,0.06,0.14,0,y,0);
    for(const s of [-1,1])stat.box(M.flur2Glass,0.235,2.15,0.01,s*1.25,1.12,0);
    plane(M.flur2Coupon,.17,.25,-1.25,1.52,.012);
    stat.box(M.flur2Wall,ew,.42,.24,0,2.49,0);
    stat.push(0,4.0,0);
    addWindow(stat,M,{w:ew,h:2.6,inset:0,frame:M.flur2Red,glass:M.flur2Glass,
      rows:[{f:.28,cols:4},{f:.44,cols:4},{f:.28,cols:4}],sill:false,frameT:.055});
    stat.pop();stat.box(M.flur2Wall,ew,.05,.2,0,5.325,0);stat.pop();
    // Feste Teile kollidieren: über der Tür und die beiden Seitenteile.
    C.addBox(E.east-.08,E.north,E.east+.12,E.south,E.y+LH+.03,F.roof,{tag:'wand',id:'flur2_aussentuer_oberteil'});
    for(const s of [-1,1]){const z0=cz+s*1.07,z1=cz+s*ew/2;C.addBox(E.east-.08,Math.min(z0,z1),E.east+.12,Math.max(z0,z1),E.y,E.y+LH+.03,{tag:'wand',id:'flur2_aussentuer_seitenteil'});}
    const door=new THREE.Group();door.name='flur2_aussentuer';door.position.set(E.east,E.y,cz);door.rotation.y=-Math.PI/2;root.add(door);
    const point=new THREE.Vector3(),toggles=[];
    for(const s of [-1,1]){
      // Holzfreie Metalltürblätter, vertikale Sichtfenster mit schmaler Gummidichtung; Drehpunkt am Seitenteil.
      const pivot=new THREE.Group();pivot.position.x=s*1.10;door.add(pivot);
      // Blatt 1,07 m vom Pfosten (±1,07) bis zur Mitte: die Flügel stoßen ohne Spalt aneinander, am Südflügel
      // dunkle Dichtungsfuge. Fenster 0,41 × 1,18 m, Unterkante 0,56 m (eingang (nah).JPG, geschätzt).
      const lb=new PartBuilder(),c=-s*.565;
      for(const u of [c-.37,c+.37])lb.box(M.flur2ExitMetal,.33,2.18,.065,u,1.12,0);
      if(s>0)lb.box(M.steelBlack,.01,2.18,.07,-s*1.095,1.12,0);
      for(const [y,h] of [[.295,.53],[1.975,.47]])lb.box(M.flur2ExitMetal,.41,h,.065,c,y,0);
      lb.box(M.flur2Glass,.41,1.18,.008,c,1.15,0);
      for(const u of [c-.21,c+.21])lb.box(M.steelBlack,.012,1.19,.07,u,1.15,0);
      lb.rod(M.chrome,[c-.43,1.02,.085],[c+.43,1.02,.085],.018,10);   // Innen: Querstange (Panikbeschlag)
      lb.box(M.flur2ExitMetal,.20,.065,.07,c-s*.32,2.13,.075);          // Türschließer innen
      // Außen am nördlichen Flügel die lange senkrechte Griffstange (eingang (nah).JPG).
      if(s<0)for(const y of [.62,1.52])lb.rod(M.chrome,[-s*.95,y,-.035],[-s*.95,y,-.09],.012,8);
      if(s<0)lb.rod(M.chrome,[-s*.95,.5,-.09],[-s*.95,1.58,-.09],.016,10);
      pivot.add(lb.build({name:'flur2_aussentuer_fluegel'}));
      const block=C.add({x:E.east,z:cz+s*.535,w:1.07,d:.065,rot:-Math.PI/2,bottom:E.y,top:E.y+LH,tag:'tuer',id:'flur2_aussentuer'});
      toggles.push(new Toggle({duration:.8,apply:k=>{
        pivot.rotation.y=-s*1.45*k;door.updateMatrixWorld(true);
        point.set(c,0,0).applyMatrix4(pivot.matrixWorld);C.update(block,{x:point.x,z:point.z,rot:-Math.PI/2+pivot.rotation.y});
      }}));
    }
    updates.push(...toggles);registerObject('flur2_aussentuer','door','Außentür Eingang 130/131',door);
    interactions.register(door,{id:'flur2_aussentuer',type:'door',label:()=>`Außentür ${toggles.some(t=>t.isOpen)?'schließen':'öffnen'}`,onInteract:()=>{
      const opening=!toggles.some(t=>t.isOpen);for(const t of toggles)if(t.isOpen!==opening)t.toggle();audio.door(opening);
    }});
    map.walls.push([E.east,E.north,E.east,E.south]);
    // Matte und erhöhte Rohrheizkörper an beiden Seiten, jeweils außerhalb des Gehwegs.
    surface(M.flur2Mat,E.stairEnd+.30,E.north+.10,E.east-.03,E.south-.10,E.y+.006,false,.75);
    for(const [z,ry] of [[E.north+.06,0],[E.south-.06,Math.PI]]){
      stat.push(16.94,E.y,z,ry);
      for(let i=0;i<19;i++)for(const depth of [.05,.115])stat.cylinder(M.radiator,.017,.017,1.66,-.53+i*.059,1.03,depth,8);
      for(const h of [.20,1.86])stat.rod(M.radiator,[-.56,h,.08],[.56,h,.08],.024,10);
      stat.rod(M.radiator,[.61,.0,.065],[.61,.30,.065],.014,8);
      stat.cylinder(M.switchWhite,.03,.03,.065,.61,.30,.09,10,Math.PI/2);stat.pop();
      C.addBox(16.35,z-.10,17.56,z+.15,E.y,E.y+1.9,{tag:'heizung'});
    }
    stat.push(17.56,E.y,E.south-.36);addTrashBin(stat,{...M,binBag:M.flur2Red},0,0);stat.pop();
    C.addBox(17.37,E.south-.55,17.75,E.south-.17,E.y,E.y+.5,{tag:'muell'});
    addSwitchPlate(stat,M,17.62,E.y+1.16,E.south-.025,Math.PI);
    // Fenstermotor und sichtbare Leitung am roten Rahmen (raum11).
    stat.box(M.switchWhite,.15,.24,.05,E.east-.12,3.55,E.south-.12);
    stat.rod(M.switchWhite,[E.east-.12,3.55,E.south-.11],[E.east-.12,4.65,E.south-.11],.009,8);
    // Nische, Podest, Stufen und Glasvordach vor der Tür baut rooms/vorplatz.js (Fotos des Eingangs).
    anchor('flur2_aussentreppe','stairs','Treppe zum Außeneingang',F.east,Y,cz);
  }
}

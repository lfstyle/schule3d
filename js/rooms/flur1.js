// Flur 1: 49 Referenzen in fotos/Flur1 einschließlich neu/ (15.10.2026).
// Maße aus 30-cm-Fliesen/Türen geschätzt. Westen = weiter in den Gang hinein.
import * as THREE from 'three';
import { PartBuilder, matrixFrom, metricBoxUV } from '../geometry.js';
import { addWall, Door, addCeilingLight, addSwitchPlate, createWallClock,
  addTrashBin, addWaterDispenser, addFramedPicture, addPendantLight, addGlazedEntrance,
  addUtilityCabinet, addFoldingLadder } from '../objects.js';
import { Toggle } from '../animated.js';
import { FOYER } from './flur.js';

// Gerade Achse vom Foyerportal, kein künstlicher Versatz am Gangbeginn.
const Z=FOYER.portalZ;
export const FLUR1={
  east:FOYER.x0,west:-22.6,north:Z-1.2,south:Z+1.2,centerZ:Z,height:3.1,
  hallEast:-11.8,hallNorth:-11.22,upperY:3.6,roofY:6.4,
  // Freier Rückweg zwischen Kern und Nordwand; Liftöffnung zeigt nach Süden.
  core:{west:-20.8,east:-18.7,north:-9.82,south:-7.62,liftX:-19.48},
  lightwell:{west:-18.7,east:-11.8,north:-11.22,south:Z-2.0},
};

export function buildFlur1(ctx){
  const {scene,collision:C,materials:M,registerObject,interactions,lighting,audio,map}=ctx;
  const F=FLUR1,H=F.height,B=F.core,L=F.lightwell;
  const root=new THREE.Group();root.name='flur_1';scene.add(root);
  const walls=new PartBuilder(),stat=new PartBuilder(),fixtures=new PartBuilder(),updates=[],lights=[];
  const wallM={...M,baseboard:M.flur1Skirting};
  const anchor=(id,type,name,x,y,z)=>{
    const o=new THREE.Object3D();o.position.set(x,y,z);root.add(o);registerObject(id,type,name,o);return o;
  };
  const plane=(mat,w,h,x,y,z,ry=0)=>{
    stat.add(mat,new THREE.PlaneGeometry(w,h),matrixFrom(x,y,z,0,ry));
  };
  const wall=(a,b,openings=[],{height=H,y0=0,material=M.flur1Wall,dado=true,mapWall=true}={})=>{
    const r=addWall(walls,wallM,{start:a,end:b,openings,height,y0,thickness:0.2,material,baseboard:false});
    r.colliders.forEach(c=>C.add({...c,tag:'wand'}));if(mapWall)map.walls.push(...r.segments);
    if(dado){
      const doors=openings.filter(o=>o.y<0.05).sort((a,b)=>a.u-b.u);
      stat.push(a[0],y0,a[1],r.rot);let cursor=0;
      for(const d of [...doors,{u:r.length,w:0}]){
        if(d.u>cursor){
          stat.box(M.flur1Dado,d.u-cursor,0.76,0.012,(cursor+d.u)/2,0.38,0.007);
          stat.box(M.flur1Skirting,d.u-cursor,0.085,0.025,(cursor+d.u)/2,0.0425,0.016);
          for(let u=cursor+0.3;u<d.u;u+=0.3)stat.box(M.baseboard,0.002,0.08,0.001,u,0.04,0.03);
        }
        cursor=d.u+d.w;
      }
      stat.pop();
    }
    return r;
  };
  const surface=(mat,x0,z0,x1,z1,y,down=false,tile=0.3)=>{
    const geo=new THREE.PlaneGeometry(x1-x0,z1-z0);geo.rotateX(down?Math.PI/2:-Math.PI/2);
    const p=geo.attributes.position,uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(p.getX(i)+(x0+x1)/2-F.east)/tile,(p.getZ(i)+(z0+z1)/2-(down?Z+0.3:F.south))/tile);
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set((x0+x1)/2,y,(z0+z1)/2);mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const floor=(x0,z0,x1,z1,y=0)=>{
    surface(M.flur1Floor,x0,z0,x1,z1,y);C.addBox(x0,z0,x1,z1,y-0.16,y,{tag:'boden',surface:'tile'});
  };
  const ceiling=(x0,z0,x1,z1,y=H)=>{
    surface(M.flur1Ceiling,x0,z0,x1,z1,y,true,0.6);
    C.addBox(x0,z0,x1,z1,y,y+0.15,{tag:'decke'});
    surface(M.foyerRoof,x0,z0,x1,z1,y+0.16).castShadow=true;
  };
  const pointLight=(x,y,z,power=8,distance=6)=>{
    const light=new THREE.PointLight(0xfff3df,power,distance,2);light.position.set(x,y,z);root.add(light);lights.push(light);
  };
  const closedDoor=(id,label,x,z,ry,{width=1.02,transom=false,frame=M.schoolRed,sign=null,hinge='left',knob=false}={})=>{
    const ow=width+0.08,oh=transom?H-0.05:2.25;
    const door=new Door({...M,glass:M.foyerGlass},{id,name:label,width,openingWidth:ow,openingHeight:oh,leafHeight:2.19,transom,
      frontMaterial:M.flur1Wood,backMaterial:M.flur1Wood,leafMaterial:M.flur1Wood,frameMaterial:frame,wallThickness:0.2,hinge,knob});
    door.group.position.set(x,0,z);door.group.rotation.y=ry;root.add(door.group);
    C.add({x,z,w:ow,d:0.21,rot:ry,bottom:0,top:oh,tag:'tuer',id});registerObject(id,'door',label,door.group);
    if(sign){
      const acrylic=sign===M.flur1Room101||sign===M.flur1Room102;
      stat.push(x,0,z,ry);stat.push(-ow/2-0.19,1.65,0);
      stat.add(sign,new THREE.PlaneGeometry(0.2,acrylic?0.175:0.15),matrixFrom(0,0,acrylic?0.04:0.022));
      if(acrylic)for(const sx of [-0.082,0.082])for(const sy of [-0.07,0.07])
        stat.cylinder(M.chrome,0.008,0.008,0.012,sx,sy,0.04,8,Math.PI/2);
      stat.pop();stat.pop();
    }
    if(transom&&frame===M.foyerFrame){
      stat.push(x,0,z,ry);
      for(const sx of [-ow/2,ow/2])stat.box(M.accentBlue,0.09,0.1,0.012,sx,2.24,0.045);
      stat.pop();
    }
    return door;
  };
  const framed=(mat,w,h,x,y,z,ry=0,frame=M.frameWhite)=>{
    stat.push(x,y,z,ry);addFramedPicture(stat,M,mat,w,h,frame);stat.pop();
  };
  const hungPicture=(mat,w,h,x,y,z,ry=0,frame=M.frameWhite)=>{
    framed(mat,w,h,x,y,z,ry,frame);
    stat.push(x,0,z,ry);
    for(const sx of [-w*0.3,w*0.3])stat.rod(M.aluminium,[sx,y+h/2+0.02,0.008],[sx,H-0.16,0.008],0.0015,5);
    stat.pop();
  };

  // Zusammenhängende Bodenplatte; die Tür und die gemeinsame Ostwand bleiben im Foyer.
  floor(F.west,F.north,F.east,F.south);
  floor(F.west,F.hallNorth,F.hallEast,F.north);
  ceiling(F.west,F.north,F.east,F.south);
  for(const z of [F.south-0.45,F.north+0.45])for(let x=F.east-0.15;x>F.west;x-=0.6){
    stat.box(M.flur1DarkTile,0.296,0.002,0.296,x,0.002,z);
  }
  // Oberhalb der Tür ein kurzer Höhenanschluss an die 3,3-m-Decke im Foyer.
  // Ost-Enden 3 mm hinter der Foyer-Wandfläche (x = F.east), sonst flackern sie mit ihr.
  const EAST=F.east-0.003;
  stat.box(M.flur1Wall,0.21,0.197,2.4,EAST-0.105,3.2015,FOYER.portalZ);   // Unterkante 3 mm über der Flurdecke
  const southDoors=[{x:-11.35,id:'flur1_101',sign:M.flur1Room101},{x:-21.5,id:'flur1_102',sign:M.flur1Room102}];
  wall([EAST,F.south],[F.west,F.south],southDoors.map(d=>({u:EAST-d.x-0.55,w:1.1,y:0,h:2.25})));
  southDoors.forEach(d=>closedDoor(d.id,d.id.endsWith('101')?'Raum 101':'Raum 102',d.x,F.south,Math.PI,{sign:d.sign,hinge:'right'}));
  plane(M.flur1Exam,0.26,0.2,-11.35,1.56,F.south-0.032,Math.PI);

  const wc=[{x:-6.48,id:'flur1_wc_schuelerinnen',label:'WC Schülerinnen',sign:M.flur1WCfemale},
    {x:-10.65,id:'flur1_wc_schueler',label:'WC Schüler',sign:M.flur1WCmale}];
  wall([F.hallEast,F.north],[EAST,F.north],wc.map(d=>({u:d.x-F.hallEast-0.55,w:1.1,y:0,h:2.25})));
  for(const d of wc){
    closedDoor(d.id,d.label,d.x,F.north,0,{frame:M.foyerFrame,hinge:d.id.endsWith('innen')?'right':'left'});
    plane(d.sign,0.14,0.17,d.x+0.72,1.68,F.north+0.027);
    // Der Schalter neben WC Schülerinnen bedient das Flurlicht (zweiter Schalter am Foyer-Ende).
    if(d.id==='flur1_wc_schuelerinnen')flurSwitch('flur1_lichtschalter_ost',d.x+0.72,F.north+0.018,0);
    else addSwitchPlate(stat,M,d.x+0.72,1.12,F.north+0.018);
    plane(M.flur1Handwash,0.2,0.29,d.x,1.56,F.north+0.004);
  }
  framed(M.flur1Plan,0.72,0.405,-6.32,1.55,F.south-0.015,Math.PI,M.aluminium);
  hungPicture(M.flur1PinkPrint,0.46,0.78,-7.65,1.79,F.north+0.015);
  hungPicture(M.flur1Print,0.82,0.55,-9.1,1.91,F.north+0.015);
  stat.box(M.switchWhite,0.15,0.24,0.10,-8.38,1.28,F.north+0.07);
  stat.box(M.foyerFrame,0.12,0.055,0.12,-8.38,1.12,F.north+0.09);
  anchor('flur1_desinfektion','decoration','Desinfektionsspender',-8.38,1.28,F.north+0.1);

  // Südwand: 101 → Wasserspender/Monitor → Schulverzeichnis → Bilder → 102.
  stat.push(-13.25,0,F.south-0.03,Math.PI);addWaterDispenser(stat,M);stat.pop();
  C.addBox(-13.67,F.south-0.43,-12.83,F.south,0,1.84,{tag:'wasserspender'});
  anchor('flur1_wasserspender','decoration','Wasserspender',-13.25,0,F.south-0.25);
  surface(M.foyerMat,-13.8,F.south-0.95,-12.7,F.south-0.4,0.004,false,0.7);
  stat.push(-13.25,2.52,F.south-0.13,Math.PI, -0.12);
  stat.box(M.black,1.05,0.61,0.06,0,0,0);
  stat.box(M.darkGlass,0.99,0.55,0.006,0,0,0.035);stat.pop();
  anchor('flur1_monitor','decoration','Informationsbildschirm',-13.25,2.52,F.south-0.13);
  framed(M.flur1Directory,1.04,0.78,-14.65,1.85,F.south-0.015,Math.PI,M.glass);
  plane(M.flur1WaterNotice,0.22,0.15,-13.25,2.02,F.south-0.023,Math.PI);
  hungPicture(M.flur1PrintLeft,0.82,0.55,-15.95,1.93,F.south-0.015,Math.PI);
  hungPicture(M.flur1Sunset,0.87,0.87,-17.15,1.77,F.south-0.015,Math.PI,M.black);
  hungPicture(M.flur1PrintRight,0.82,0.55,-18.35,1.93,F.south-0.015,Math.PI);
  anchor('flur1_sonnenbild','decoration','Sonnenuntergangsbild',-17.15,1.7,F.south-0.02);

  // Niedrige Rasterdecke: mittlere graue Felder, quer liegende Rasterleuchten.
  for(let x=F.east-0.3;x>F.west;x-=1.2){
    stat.box(M.flur1GreyCeiling,0.594,0.006,0.594,x,H-0.005,Z);
    if(Math.round((F.east-x)/1.2)%2===0)stat.cylinder(M.switchWhite,0.065,0.065,0.018,x,H-0.018,Z,16);
    else {stat.cylinder(M.foyerFrame,0.047,0.047,0.007,x-0.6,H-0.009,Z,14);}
  }
  for(let x=F.east-1.2;x>F.west;x-=2.4)addCeilingLight(fixtures,{...M,lightPanel:M.flur1Light},x,H,Z,{length:1.65,width:0.13});
  for(const x of [-7.9,-11.9,-16.0,-20.5])pointLight(x,2.73,Z,7,6);
  stat.box(M.flur1Wall,EAST-F.west,0.13,0.07,(EAST+F.west)/2,H-0.06,F.south-0.035);
  for(const z of [F.south-0.022,F.north+0.022])stat.box(M.frameWhite,EAST-F.west,0.018,0.018,(EAST+F.west)/2,H-0.16,z);
  for(const x of [-6.7,F.hallEast,-20.3])stat.box(M.aluminium,0.018,0.002,2.4,x,0.003,Z);   // 1 mm über den dunklen Fliesen

  // Zweiseitige Uhr und Rettungszeichen hängen frei im Gang.
  stat.rod(M.foyerFrame,[-14.6,H,Z],[-14.6,2.7,Z],0.008,8);
  for(const ry of [-Math.PI/2,Math.PI/2]){
    const clock=createWallClock(M);clock.position.set(-14.6,2.56,Z);clock.rotation.y=ry;root.add(clock);
  }
  anchor('flur1_uhr','decoration','Doppelseitige Fluruhr',-14.6,2.56,Z);
  for(const x of [-14.05,-21.9]){
    for(const z of [Z-0.11,Z+0.11])stat.rod(M.foyerFrame,[x,H,z],[x,2.7,z],0.005,6);
    plane(M.exitSign,0.32,0.15,x,2.62,Z,Math.PI/2);
    plane(M.exitSign,0.32,0.15,x-0.008,2.62,Z,-Math.PI/2);
  }

  buildEntranceHall();
  buildLiftNiche();
  buildEndPartition();

  // Eigener Stromkreis, Schalter auf der im Foto belegten Wand neben Raum 102.
  flurSwitch('flur1_lichtschalter',-22.24,F.south-0.018,Math.PI);
  function flurSwitch(id,x,z,ry){
    const sb=new PartBuilder();addSwitchPlate(sb,M,0,1.12,0);
    const sw=sb.build({name:id});sw.position.set(x,0,z);sw.rotation.y=ry;root.add(sw);
    registerObject(id,'switch','Licht Flur 1',sw);
    interactions.register(sw,{id,type:'switch',label:()=>lighting.isOn('licht_flur1')?'Flurlicht ausschalten':'Flurlicht einschalten',onInteract:()=>{lighting.toggle('licht_flur1');audio.click();}});
  }
  lighting.addCircuit('licht_flur1',{lights,panels:[M.flur1Light],glows:[[M.flur1Pendant,0.08]],on:true,
    regions:[[F.west-0.05,F.north,F.east,F.south+0.05],[F.west-0.05,F.hallNorth-0.1,F.hallEast,F.north]]});
  lighting.addDaylight(root,'licht_flur1',{position:[-15.8,2.65,F.hallNorth-0.65],intensity:15,distance:8});
  // Zusätzliches Tageslicht durch die jetzt klaren Scheiben der roten Türen.
  lighting.addDaylight(root,'licht_flur1',{position:[-17.75,2.3,F.hallNorth-0.6],intensity:9,distance:7});
  root.add(walls.build({name:'flur1_waende',castShadow:false}),stat.build({name:'flur1_ausstattung'}),fixtures.build({name:'flur1_leuchten',castShadow:false}));
  // Körnung in Metern statt ein gestrecktes Foto pro unterschiedlich großer Wandfläche.
  root.traverse(o=>{if(o.isMesh&&o.material===M.flur1Wall)metricBoxUV(o.geometry,0.32);});
  map.areas.push({poly:[[F.east,F.south],[F.west,F.south],[F.west,F.hallNorth],[F.hallEast,F.hallNorth],[F.hallEast,F.north],[F.east,F.north]],fill:'rgba(215,205,180,0.14)'});
  map.labels.push({text:'Flur 1',x:-9,z:Z},{text:'Eingangshalle',x:-16,z:-9.4},{text:'Aufzug',x:B.liftX,z:B.south-0.5});
  return {id:'flur_1',name:'Flur 1',root,bounds:{minX:F.west-0.2,maxX:F.east,minZ:F.hallNorth-0.2,maxZ:F.south+0.2,maxY:F.roofY+0.2},
    update(dt){updates.forEach(u=>u.update(dt));},
    areaName(p){
      if(p.y<-0.5||p.y>F.roofY+0.2||p.x>F.east-0.2||p.x<F.west-0.2||p.z<F.hallNorth-0.2||p.z>F.south+0.2)return null;
      if(p.z<F.north&&p.x>F.hallEast)return null;
      if(p.x<B.west&&p.z<F.north)return 'Flur 1 · Aufzugnische';
      if(p.z<F.north)return 'Flur 1 · Eingangshalle';return 'Flur 1';
    }};

  function buildEntranceHall(){
    // Nordfassade: drei separate rote Türen, seitliche Holztüren und Oberlichter.
    wall([F.hallEast,F.hallNorth],[F.hallEast,F.north],[],{height:F.roofY});
    wall([F.west,F.south],[F.west,F.hallNorth],[{u:0,w:F.south-F.north,y:0,h:H}],{height:H});
    const redXs=[-17.75,-15.8,-13.85],sideXs=[-21.65,-12.32],caretakerX=-19.47;
    const openings=[...redXs.map(x=>({u:x-F.west-0.83,w:1.66,y:0,h:H})),
      ...[...sideXs,caretakerX].map(x=>({u:x-F.west-0.55,w:1.1,y:0,h:H-0.05}))];
    wall([F.west,F.hallNorth],[F.hallEast,F.hallNorth],openings,{height:F.roofY,dado:false});
    closedDoor('flur1_halle_tuer_'+Math.abs(sideXs[0]),'Raum 121 · Lehrerstützpunkt',sideXs[0],F.hallNorth,0,{transom:true,frame:M.foyerFrame,sign:M.flur1Room121,knob:true,hinge:'right'});
    closedDoor('flur1_122','Raum 122 · Hausmeister',caretakerX,F.hallNorth,0,{transom:true,frame:M.foyerFrame,sign:M.flur1Room122,knob:true,hinge:'right'});
    plane(M.flur1CaretakerNotice,0.27,0.38,caretakerX,1.57,F.hallNorth+0.004);
    // Holz-/Drahtglasfelder zwischen 121/122 statt der früheren Putzlücken.
    for(const [x0,x1] of [[F.west,-22.2],[-21.1,-20.02],[-18.92,-18.62]]){
      const x=(x0+x1)/2,w=x1-x0;
      stat.box(M.flur1Wood,w,2.22,0.045,x,1.11,F.hallNorth+0.005);
      stat.box(M.foyerGlass,w-0.03,0.75,0.01,x,2.66,F.hallNorth+0.028);
      for(const y of [2.24,3.06])stat.box(M.foyerFrame,w,0.045,0.08,x,y,F.hallNorth+0.04);
      for(const sx of [x0,x1]){
        stat.box(M.foyerFrame,0.035,H-0.02,0.08,sx,(H-0.02)/2,F.hallNorth+0.035);
        stat.box(M.accentBlue,0.09,0.1,0.012,sx,2.24,F.hallNorth+0.083);
      }
    }
    // Vorhandene Holztür neben den roten Türen gehört laut neuen Fotos zu Raum 125.
    const labId='flur1_halle_tuer_12.32';
    const labDoor=new Door({...M,glass:M.podcastGlass},{id:labId,name:'125 · Future Lab',width:1.02,openingWidth:1.1,openingHeight:H-0.05,leafHeight:2.19,
      wallThickness:0.2,hinge:'right',transom:true,knob:true,knobBack:false,casingBack:true,frameMaterial:M.foyerFrame,frontMaterial:M.flur1Wood,backMaterial:M.flur1Wood,leafMaterial:M.flur1Wood});
    labDoor.group.position.set(sideXs[1],0,F.hallNorth);root.add(labDoor.group);registerObject(labId,'door','125 · Future Lab',labDoor.group);
    const labCollider=C.add({x:sideXs[1],z:F.hallNorth,w:1.01,d:0.065,bottom:0,top:2.19,tag:'tuer',id:labId});
    const labPoint=new THREE.Vector3();
    const labToggle=new Toggle({duration:0.8,apply:k=>{
      labDoor.pivot.rotation.y=-1.65*k;labDoor.group.updateMatrixWorld(true);labDoor.leaf.getWorldPosition(labPoint);
      C.update(labCollider,{x:labPoint.x,z:labPoint.z,rot:labDoor.pivot.rotation.y});
    }});
    updates.push(labToggle);labDoor.group.userData.toggle=labToggle;
    const labLink={rooms:['licht_futurelab','licht_flur1'],normal:[0,1]};
    lighting.portals.add({...labLink,id:labId,center:[sideXs[1],1.095,F.hallNorth-0.1],width:1.02,height:2.19,hinge:1,
      opening:()=>1-Math.cos(Math.min(Math.abs(labDoor.pivot.rotation.y),Math.PI/2))});
    lighting.portals.add({...labLink,id:labId+'_oberlicht',center:[sideXs[1],2.64,F.hallNorth-0.1],
      width:1.02,height:0.7,transmission:0.55,range:4.5});
    interactions.register(labDoor.group,{id:labId,type:'door',label:()=>`Future Lab ${labToggle.isOpen?'schließen':'öffnen'}`,onInteract:()=>audio.door(labToggle.toggle())});
    for(const x of [sideXs[1]-0.52,sideXs[1]+0.52])C.addBox(x-0.03,F.hallNorth-0.22,x+0.03,F.hallNorth+0.04,0,2.25,{tag:'zarge'});
    C.addBox(sideXs[1]-0.55,F.hallNorth-0.2,sideXs[1]+0.55,F.hallNorth,2.19,H,{tag:'sturz'});
    // Schmaler weißer Pfeiler laut Außenfoto: Schild hängt auf Putz, nicht im roten Seitenfenster.
    stat.box(M.flur1Wall,0.14,H-0.05,0.23,-12.95,(H-0.05)/2,F.hallNorth+0.025);
    stat.box(M.flur1Dado,0.14,0.76,0.012,-12.95,0.38,F.hallNorth+0.146);
    C.addBox(-13.02,F.hallNorth-0.09,-12.88,F.hallNorth+0.14,0,H,{tag:'wand'});
    plane(M.foyerRoom125,0.14,0.14,-12.95,1.65,F.hallNorth+0.153);
    const labNotice=new THREE.Mesh(new THREE.PlaneGeometry(0.27,0.4),M.futureLabNotice);labNotice.position.set(0,0.43,0.025);labNotice.userData.interactionId=labId;labDoor.leaf.add(labNotice);
    // Rote Türen bedienbar (E): Flügel schlägt nach außen in die Vorhalle auf, Band links (von innen), Seitenfeld fest.
    for(let i=0;i<redXs.length;i++){
      const x=redXs[i],z=F.hallNorth+0.015,id='flur1_eingang_'+i,lb=new PartBuilder();
      stat.push(x,0,z);const {hingeX,doorW,lh}=addGlazedEntrance(stat,M,{w:1.66,glass:M.flur1EntranceGlass,leafBuilder:lb});stat.pop();
      lb.add(M.paper,new THREE.PlaneGeometry(0.15,0.19),matrixFrom(doorW/2,1.62,0.02));
      const group=new THREE.Group();group.name=id;group.position.set(x+hingeX,0,z);root.add(group);
      const leafMesh=lb.build({name:'rote_tuer_fluegel'});group.add(leafMesh);
      const sideX0=x+hingeX+doorW+0.03;
      C.addBox(sideX0,F.hallNorth-0.1,x+0.83,F.hallNorth+0.08,0,H,{tag:'tuer',id:id+'_seitenfeld'});
      C.addBox(x+hingeX-0.04,F.hallNorth-0.1,sideX0,F.hallNorth+0.08,lh,H,{tag:'sturz'});
      const block=C.add({x:x+hingeX+doorW/2,z,w:doorW,d:0.06,bottom:0,top:lh,tag:'tuer',id});
      const toggle=new Toggle({duration:0.9,apply:k=>{
        group.rotation.y=1.45*k;
        C.update(block,{x:x+hingeX+Math.cos(group.rotation.y)*doorW/2,z:z-Math.sin(group.rotation.y)*doorW/2,rot:group.rotation.y});
      }});
      updates.push(toggle);group.userData.toggle=toggle;registerObject(id,'door','Rote Eingangstür '+(i+1),group);
      interactions.register(group,{id,type:'door',label:()=>`Eingangstür ${toggle.isOpen?'schließen':'öffnen'}`,onInteract:()=>audio.door(toggle.toggle())});
      surface(M.foyerMat,x-0.45,F.hallNorth+0.75,x+0.45,F.north-0.35,0.004,false,0.65);
    }
    for(let z=F.hallNorth+0.07;z<F.hallNorth+0.61;z+=0.035)stat.box(M.foyerFrame,5.75,0.008,0.012,-15.8,0.005,z);
    // Durchsichtige Türen (Nutzerwunsch): dahinter Vorhalle und Schulgasse (rooms/schulgasse.js, Portal schulgasse_eingang).
    stat.box(M.redSteel,0.28,0.36,0.11,-20.55,1.32,F.hallNorth+0.08);
    plane(M.fireAlarmFace,0.23,0.3,-20.55,1.32,F.hallNorth+0.14);

    // Breiter hoher Heizkörper laut flur9 und neu/raum zu futurelab.
    for(let j=0;j<33;j++)stat.box(M.radiator,0.09,2.16,0.042,F.hallEast-0.075,1.28,-8.65-j*0.055);
    for(const y of [0.23,2.32])stat.rod(M.radiator,[F.hallEast-0.09,y,-8.63],[F.hallEast-0.09,y,-10.44],0.022,10);
    C.addBox(F.hallEast-0.14,-10.48,F.hallEast,-8.6,0,2.4,{tag:'heizkoerper'});

    // Die Galerie läuft an West- und Südseite; kein erfundener Steg vor der oberen Holzfront.
    const strips=[[F.west,F.hallNorth,L.west,F.north],[L.west,L.south,L.east,F.north]];
    for(const [x0,z0,x1,z1] of strips){
      ceiling(x0,z0,x1,z1);floor(x0,z0,x1,z1,F.upperY);
      stat.boxMinMax(M.flur1Wall,x0,H+0.018,z0,x1,F.upperY-0.01,z1);
    }
    // Über dem niedrigen Hauptgang liegt derselbe obere Galerieflur.
    floor(F.west,F.north,F.hallEast,F.south,F.upperY);
    wall([F.hallEast,F.south],[F.west,F.south],[],{y0:F.upperY,height:F.roofY-F.upperY,mapWall:false});
    wall([F.west,F.south],[F.west,F.hallNorth],[],{y0:H,height:F.roofY-H,mapWall:false,dado:false});
    ceiling(F.west,F.hallNorth,F.hallEast,F.south,F.roofY);
    for(let x=F.hallEast-0.3;x>F.west;x-=1.2)for(const z of [Z,-9.42]){
      stat.box(M.flur1GreyCeiling,0.594,0.006,0.594,x,F.roofY-0.005,z);
    }
    railing([L.east,L.south],[L.west,L.south],F.upperY,true);
    const midSouth=L.south-1.15,midNorth=L.north+0.75;
    railing([L.west,L.south],[L.west,midSouth],F.upperY);
    railing([L.west,midSouth],[L.west,midNorth],F.upperY,true);
    railing([L.west,midNorth],[L.west,L.north],F.upperY);
    // Vier hohe Holz-/Glasfelder über den roten Türen, getrennt durch Putzpfeiler.
    const upperPanel=(x,w)=>{
      stat.box(M.flur1Wood,w,2.05,0.05,x,F.upperY+1.025,F.hallNorth+0.025);
      stat.box(M.foyerGlass,w-0.07,0.65,0.012,x,F.roofY-0.35,F.hallNorth+0.06);
      for(const sx of [-w/2,w/2])stat.box(M.flur1Wood,0.05,F.roofY-F.upperY,0.08,x+sx,(F.roofY+F.upperY)/2,F.hallNorth+0.065);
      stat.box(M.flur1Wood,w,0.05,0.09,x,F.upperY+2.05,F.hallNorth+0.06);
    };
    for(let x=F.west+0.6;x<L.west-0.5;x+=1.2)upperPanel(x,1.15);
    const bay=(L.east-L.west)/4;
    for(let i=0;i<4;i++)upperPanel(L.west+(i+0.5)*bay,bay-0.2);
    for(let i=0;i<=4;i++)stat.box(M.flur1Wall,0.18,F.roofY-F.upperY,0.24,L.west+i*bay,(F.roofY+F.upperY)/2,F.hallNorth+0.11);
    for(const x of [-17.7,-14.4]){
      addPendantLight(fixtures,M,x,4.35,-9.4,F.roofY);pointLight(x,4.23,-9.4,14,8);
    }
    for(const x of [-21.3,-19.6,-16.4,-14.0]){
      if(x<L.west)addCeilingLight(fixtures,{...M,lightPanel:M.flur1Light},x,H,F.hallNorth+0.48,{length:1.2,ry:Math.PI/2});
      addCeilingLight(fixtures,{...M,lightPanel:M.flur1Light},x,F.roofY,F.north+0.2,{length:1.2,ry:Math.PI/2});
    }
  }

  function railing(a,b,y,horizontal=false){
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/(horizontal?1.05:0.15));
    for(let i=0;i<=n;i++){
      const t=i/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      stat.rod(M.foyerFrame,[x,y+0.06,z],[x,y+1.0,z],horizontal||i%7===0?0.018:0.009,6);
    }
    if(horizontal)for(const h of [0.3,0.53,0.76])stat.rod(M.foyerFrame,[a[0],y+h,a[1]],[b[0],y+h,b[1]],0.009,8);
    stat.rod(M.handrailWood,[a[0],y+1.03,a[1]],[b[0],y+1.03,b[1]],0.026,10);
    stat.rod(M.foyerFrame,[a[0],y+0.13,a[1]],[b[0],y+0.13,b[1]],0.012,8);
    C.add({x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,w:len,d:0.08,rot:-Math.atan2(b[1]-a[1],b[0]-a[0]),bottom:y,top:y+1.05,tag:'gelaender'});
  }

  function buildLiftNiche(){
    // Flur21/25 + FLUR26: Lift zum Hauptgang, Schränke westlich, Durchgang nördlich.
    wall([B.east,B.north],[B.west,B.north]);
    wall([B.west,B.north],[B.west,B.south]);
    wall([B.west,B.south],[B.east,B.south],[{u:B.liftX-B.west-0.7,w:1.4,y:0,h:2.55}]);
    wall([B.east,B.south],[B.east,B.north]);
    C.addBox(B.west,B.north,B.east,B.south-0.18,0,H,{tag:'aufzugkern'});
    map.furniture.push([B.west,B.north,B.east,B.south]);
    // Die Schaukästen stehen auf der nach Osten gerichteten Stirnseite.
    stat.push(B.east+0.025,1.64,(B.north+B.south)/2,Math.PI/2);
    addFramedPicture(stat,M,M.flur1Noticeboard,1.65,1.03,M.foyerFrame);
    stat.box(M.foyerFrame,0.024,1.05,0.08,0,0,0.03);
    stat.box(M.podcastGlass,1.62,1.0,0.004,0,0,0.048);stat.pop();
    anchor('flur1_schaukasten','decoration','Schaukasten am Aufzugkern',B.east,1.64,(B.north+B.south)/2);
    // Echte Laibung statt einer auf die Seitenwand geklebten Aufzugfront.
    stat.push(B.liftX,0,B.south);
    for(const s of [-1,1]){
      stat.box(M.flur1Wall,0.08,2.55,0.24,s*0.66,1.275,-0.09);
      stat.box(M.flur1Lift,0.055,2.4,0.09,s*0.594,1.2,-0.11);
      stat.box(M.flur1Lift,0.562,2.2,0.024,s*0.283,1.12,-0.155);
      stat.box(M.steelBlack,0.045,0.30,0.014,s*0.596,1.16,-0.057);
      for(const y of [1.1,1.19])stat.cylinder(M.chrome,0.011,0.011,0.006,s*0.596,y,-0.046,12,Math.PI/2);
    }
    stat.box(M.flur1Wall,1.4,0.09,0.24,0,2.505,-0.09);
    stat.box(M.flur1Lift,1.25,0.23,0.09,0,2.335,-0.11);
    stat.box(M.black,0.004,2.2,0.005,0,1.12,-0.14);
    stat.box(M.aluminium,1.26,0.016,0.26,0,0.009,-0.09);
    for(let j=0;j<4;j++)stat.box(M.foyerFrame,1.23,0.002,0.004,0,0.018,-0.19+j*0.037);
    stat.add(M.flur1LiftSign,new THREE.PlaneGeometry(0.27,0.09),matrixFrom(0.28,1.8,-0.14));
    stat.add(M.flur1LiftWarning,new THREE.PlaneGeometry(0.065,0.16),matrixFrom(0.595,1.66,-0.06));
    for(let j=0;j<5;j++)stat.box(M.paper,0.13,0.005,0.002,0.41,2.4-j*0.024,-0.062);
    stat.pop();
    C.addBox(B.liftX-0.61,B.south-0.17,B.liftX+0.61,B.south-0.13,0,2.42,{tag:'tuer',id:'flur1_aufzug'});
    anchor('flur1_aufzug','door','Aufzug',B.liftX,0,B.south-0.14);
    // Feuerlöschschrank an der Westwand neben dem Glasabschluss.
    stat.push(F.west+0.016,1.28,-8.6,Math.PI/2);
    stat.box(M.foyerFrame,0.92,1.04,0.035,0,0,0.018);
    for(const s of [-1,1]){
      stat.box(M.plinth,0.44,0.99,0.008,s*0.225,0,0.04);
      stat.cylinder(M.black,0.035,0.035,0.012,s*0.075,0,0.051,14,Math.PI/2);
      stat.box(M.aluminium,0.012,0.045,0.007,s*0.075,0,0.061);
    }
    stat.add(M.fireSign,new THREE.PlaneGeometry(0.16,0.19),matrixFrom(-0.24,0.17,0.05));
    stat.box(M.red,0.13,0.13,0.04,-0.24,0.36,0.06);stat.pop();
    // FLUR26: breiter weißer Mehrtürenschrank, schmaler Holzschrank und Aluleiter.
    // Fronten zeigen nach Westen. Die Modelle bleiben innerhalb ihrer Kollisionen.
    for(const [id,label,z,w,h,mat] of [
      ['flur1_holzschrank','Holzschrank mit Erste-Hilfe-Zeichen',-8.65,0.55,2.2,M.flur1Wood],
      ['flur1_putzschrank','Weißer Schrank',-9.45,1.0,2.42,M.switchWhite],
    ]){
      stat.push(B.west,0,z,-Math.PI/2);
      addUtilityCabinet(stat,M,{width:w,height:h,depth:0.5,material:mat,splitBase:mat===M.switchWhite});
      if(mat===M.switchWhite)stat.add(M.flur1CabinetNotice,new THREE.PlaneGeometry(0.32,0.23),matrixFrom(-0.19,1.67,0.525));
      else{
        stat.add(M.flur1FirstAid,new THREE.PlaneGeometry(0.12,0.12),matrixFrom(0,1.75,0.525));
        stat.box(M.cardboard,0.47,0.27,0.42,0,h+0.135,0.25);
      }
      stat.pop();
      C.addBox(B.west-0.54,z-w/2,B.west,z+w/2,0,h,{tag:'schrank',id});
      map.furniture.push([B.west-0.54,z-w/2,B.west,z+w/2]);
      anchor(id,'cabinet',label,B.west-0.5,0,z);
    }
    stat.push(B.west-0.30,0,-10.1,-Math.PI/2);addFoldingLadder(stat,M);stat.pop();
    C.addBox(B.west-0.64,-10.35,B.west-0.27,-9.85,0,2.32,{tag:'leiter'});
    anchor('flur1_leiter','decoration','Aluminiumleiter',B.west-0.44,0,-10.1);
    // neu/ecke.JPG: hölzerne Rückseiten bilden die Südseite des schmalen Rückwegs.
    // 90 cm lichte Breite zur Raumfront, keine Wand quer durch diesen Durchgang.
    const cabNorth=B.north-0.48;
    for(let x=B.west+0.35;x<B.east;x+=0.7){
      stat.box(M.flur1Wood,0.69,2.42,0.48,x,1.21,B.north-0.24);
      stat.box(M.foyerFrame,0.69,0.055,0.46,x,0.0275,B.north-0.24);
      stat.box(M.flur1Wood,0.72,0.025,0.52,x,2.432,B.north-0.24);
    }
    C.addBox(B.west,cabNorth,B.east,B.north,0,2.45,{tag:'schrank',id:'flur1_schrankrueckseiten'});
    map.furniture.push([B.west,cabNorth,B.east,B.north]);
    anchor('flur1_schrankrueckseiten','cabinet','Schrankrückseiten am Hausmeistergang',(B.west+B.east)/2,0,cabNorth);
    addTrashBin(stat,M,B.west-0.23,-8.08);
    // Der obere Beutelrand sitzt über dem schwarzen, offenen Behälter.
    stat.cylinder(M.binBlack,0.157,0.157,0.006,B.west-0.23,0.484,-8.08,18);
    C.addBox(B.west-0.42,-8.27,B.west-0.04,-7.89,0,0.49,{tag:'muell'});
    pointLight(-21.7,2.7,-9.3,6,4);
  }

  function buildEndPartition(){
    // Vorläufiges Kartenende auf Nutzerwunsch: geschlossene Tür und dunkles Glas.
    const x=F.west,w=2.4,doorZ=Z+0.59;
    stat.push(x,0,Z,Math.PI/2);
    for(const u of [-w/2,0,w/2])stat.box(M.flur1Wood,0.055,H,0.13,u,H/2,0);
    for(const y of [2.25,H-0.03])stat.box(M.flur1Wood,w,0.055,0.13,0,y,0);
    stat.box(M.flur1Wood,1.2,0.055,0.1,0.6,0.88,0);
    stat.box(M.flur1EndGlass,1.14,2.18,0.008,0.6,1.12,0);
    stat.box(M.flur1EndGlass,w-0.09,0.76,0.008,0,2.66,0);
    stat.add(M.flur1UpperSign,new THREE.PlaneGeometry(0.98,0.14),matrixFrom(0.6,1.81,0.01));stat.pop();
    C.addBox(x-0.07,F.north,x+0.07,F.south,0,H,{tag:'wand',id:'flur1_kartenende'});
    map.walls.push([x,F.north,x,F.south]);
    const door=new Door(M,{id:'flur1_tuer_weiter',width:1.09,openingWidth:1.16,openingHeight:2.25,leafHeight:2.19,transom:false,
      frontMaterial:M.flur1Wood,backMaterial:M.flur1Wood,leafMaterial:M.flur1Wood,frameMaterial:M.flur1Wood,wallThickness:0.12,hinge:'left'});
    door.group.position.set(x,0,doorZ);door.group.rotation.y=Math.PI/2;root.add(door.group);
    registerObject('flur1_tuer_weiter','door','Geschlossene Tür · Kartenende',door.group);
  }
}

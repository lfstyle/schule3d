// Foyer v4 – freigegebener Fotoabgleich, siehe docs/PLANUNG.md.
// x = Ost, z = Süd. Maße aus Türbreiten / Fliesen geschätzt, keine Vermessung.
// Die gemeinsame Südwand inkl. Tür/Fenstern gehört weiterhin zum Aufenthaltsraum.
import * as THREE from 'three';
import { PartBuilder, instancePrototype, matrixFrom, metricBoxUV } from '../geometry.js';
import { addWall, addWindow, Door, addCeilingLight, addSwitchPlate, addTrashBin,
  createWallClock, createCrate, addSchoolTable, addSlatBench, createDoubleDoor,
  addRadiator, addHighTable, addHighSeat, addMobileBoard, addDepositBin } from '../objects.js';
import { Toggle } from '../animated.js';
import { FLUR3, returnStairRegions } from '../flur3-layout.js';

// Nutzerkorrektur: Abstand zwischen Aufenthaltsraum und Holzfront +1,8 m.
const EXTRA_WIDTH = 1.8;
const NORTH_WALL_Z = -5.05-EXTRA_WIDTH;
export const FOYER = {
  extraWidth: EXTRA_WIDTH,
  x0: -5.2, x1: 5.6, z0: NORTH_WALL_Z, z1: -0.25, height: 3.3,
  recess: { x: 0.1, z: -6.05-EXTRA_WIDTH },
  portalZ: -5.52,
  stairX0: 5.6, stairX1: 8.3, landingX1: 11.0,
  down: { z0: NORTH_WALL_Z, z1: -3.62, bottom: -1.53 },
  up: { z0: -3.5, z1: -0.9, top: 1.53 }, stairCeiling: 4.9,
};
// Vergleichsblicke: Flur11, Flur7, Flur10, Flur9.
export const FOYER_VIEWS = {
  eingang: { x:-4.15,y:0,z:-5.25-EXTRA_WIDTH,yaw:-2.05,pitch:-0.03 },
  rueckblick: { x:4.65,y:0,z:-3.65-EXTRA_WIDTH/2,yaw:1.8,pitch:-0.03 },
  holzwand: { x:4.7,y:0,z:-1.15,yaw:0.58,pitch:0.02 },
  treppen: { x:3.8,y:0,z:-3.1-EXTRA_WIDTH/2,yaw:-Math.PI/2,pitch:-0.16 },
};

export function buildFlurEG(ctx) {
  const {scene,collision:C,materials,registerObject,interactions,lighting,audio,map}=ctx;
  const M={...materials,foyerWood:materials.foyerPhotoWood,foyerPlaster:materials.foyerPhotoPlaster,
    stairBlue:materials.foyerPhotoStair,foyerGlass:materials.foyerWireGlass,foyerFrame:materials.partitionFrame,
    facadeFrame:materials.partitionFrame,perforated:materials.foyerPerforated};
  const F=FOYER,H=F.height,root=new THREE.Group();root.name='flur_eg';scene.add(root);
  const middleZ=(F.z0+F.z1)/2;
  const walls=new PartBuilder(),stat=new PartBuilder(),lampGeo=new PartBuilder(),updates=[],lights=[];
  const wallM={...M,baseboard:M.schoolTop};
  const wall=(a,b,openings=[],{y0=0,height=H,t=0.22,material=M.foyerPlaster,noMap=false}={})=>{
    const r=addWall(walls,wallM,{start:a,end:b,openings,y0,height,thickness:t,material});
    r.colliders.forEach(c=>C.add({...c,tag:'wand'}));if(!noMap)map.walls.push(...r.segments);return r;
  };
  const surface=(mat,x0,z0,x1,z1,y,{down=false,tile=1.2}={})=>{
    const g=new THREE.PlaneGeometry(x1-x0,z1-z0);g.rotateX(down?Math.PI/2:-Math.PI/2);
    const uv=g.attributes.uv,p=g.attributes.position;
    // Weltkoordinaten verhindern versetzte Fliesenfugen an Teilflächen.
    for(let i=0;i<uv.count;i++)uv.setXY(i,(p.getX(i)+(x0+x1)/2)/tile,(p.getZ(i)+(z0+z1)/2)/tile);
    const m=new THREE.Mesh(g,mat);m.position.set((x0+x1)/2,y,(z0+z1)/2);m.receiveShadow=true;root.add(m);return m;
  };
  const floor=(x0,z0,x1,z1,y=0,mat=M.tileFloor)=>{
    surface(mat,x0,z0,x1,z1,y);C.addBox(x0,z0,x1,z1,y-0.18,y,{tag:'boden',surface:mat===M.purpleFloor?'lino':'tile'});
  };
  const ceiling=(x0,z0,x1,z1,y,mat=M.foyerCeiling)=>{
    surface(mat,x0,z0,x1,z1,y,{down:true,tile:5});C.addBox(x0,z0,x1,z1,y,y+0.18,{tag:'decke'});
    // Dachoberseite hält direktes Sonnenlicht aus dem Innenraum fern.
    surface(M.foyerRoof,x0,z0,x1,z1,y+0.17).castShadow=true;
  };
  const decal=(mat,w,h,x,y,z,ry=0)=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);m.rotation.y=ry;root.add(m);return m;
  };
  const anchor=(id,type,name,x,y,z)=>{
    const o=new THREE.Object3D();o.position.set(x,y,z);root.add(o);registerObject(id,type,name,o);return o;
  };
  const lamp=(x,y,z,intensity=4,distance=7)=>{
    const l=new THREE.PointLight(0xfff3e3,intensity,distance,2);l.position.set(x,y,z);root.add(l);lights.push(l);
  };

  // Verbreiterter Hauptraum und um einen Meter zurückgesetzte Front von Raum 125.
  floor(F.x0,F.z0,F.x1,F.z1);floor(F.x0,F.recess.z,F.recess.x,F.z0);
  ceiling(F.x0,F.z0,F.x1,F.z1,H);ceiling(F.x0,F.recess.z,F.recess.x,F.z0,H);
  map.areas.push({poly:[[F.x0,F.recess.z],[F.recess.x,F.recess.z],[F.recess.x,F.z0],[F.x1,F.z0],[F.x1,F.z1],[F.x0,F.z1]],fill:'rgba(255,255,255,0.1)'});
  map.labels.push({text:'Foyer',x:0,z:middleZ});
  // Einlegefuge. Die Sitzgruppen stehen wandnah, die Mitte bleibt frei.
  for(const s of [-1,1]){
    stat.box(M.lineDark,1.8,0.002,0.035,-1.7,0.002,middleZ-0.25+s*0.9);
    stat.box(M.lineDark,0.035,0.002,1.8,-1.7+s*0.9,0.002,middleZ-0.25);
  }
  for(const [a,b] of [[-4.48,-3.43],[-3.38,-2.32]])surface(M.foyerMat,a,-1.65,b,-0.6,0.004,{tile:0.7});
  surface(M.foyerMat,-4.48,-0.57,-2.32,-0.26,0.004,{tile:0.4});
  for(let z=-0.53;z<-0.27;z+=0.025)stat.box(M.foyerFrame,2.12,0.003,0.004,-3.4,0.006,z);
  const downCenterZ=(F.down.z0+F.down.z1)/2;
  surface(M.foyerMat,4.15,downCenterZ-1.2,5.52,downCenterZ+1.2,0.004,{tile:0.7});

  // Südseite: Eingang und hohe Glasfelder in einer Flucht mit der Aufenthaltsraum-Tür.
  const facade=[[-5.05,-4.55],[-2.25,-1.12],[-0.83,-0.4]],ent=[-4.48,-2.32];
  const opening=(a,b,y=0.06,h=3.1)=>({u:-0.4-b,w:b-a,y,h});
  wall([-0.4,F.z1],[F.x0,F.z1],[...facade.map(f=>opening(...f)),opening(...ent,0,3.16)],{t:0.35});
  for(const [a,b] of facade){
    stat.push((a+b)/2,1.61,F.z1,Math.PI);
    addWindow(stat,M,{w:b-a,h:3.1,inset:0.12,frame:M.facadeFrame,rows:[{f:0.76,cols:1},{f:0.24,cols:1}],sill:false,frameT:0.045});stat.pop();
    stat.rod(M.steel,[a+0.04,0.68,F.z1-0.02],[b-0.04,0.68,F.z1-0.02],0.015,8);
  }
  wall([-0.4,0.02],[-0.4,F.z1],[],{t:0.4});
  stat.boxMinMax(M.foyerPlaster,-0.4,0,F.z1,0,H,-0.003);   // endet in der Aufenthaltsraumwand (ragte 2 cm in dessen Ecke und flackerte)
  C.addBox(-0.4,F.z1,0,0.02,0,H,{tag:'wand'});
  pair('haupteingang','Haupteingang',(ent[0]+ent[1])/2,F.z1,Math.PI,ent[1]-ent[0],true,false);
  hangingExit(-3.4,H,-0.6,Math.PI,'down');
  for(const [x,w] of [[-4.81,0.45],[-1.68,0.94]]){
    stat.push(x,0,F.z1-0.04,Math.PI);addRadiator(stat,M,{width:w,height:0.23,depth:0.11,y0:0.1});stat.pop();
    stat.push(x,0,-0.68);addSlatBench(stat,M,{length:w+0.05});stat.pop();
    C.addBox(x-w/2-0.03,-0.85,x+w/2+0.03,-0.49,0,0.45,{tag:'bank'});
    anchor('fensterbank_'+Math.abs(x),'bench','Bank vor dem Fensterheizkörper',x,0,-0.68);
  }
  // Der begehbare Hof besitzt Boden, Rost und Außengrenzen in aussenbereich.js.
  addTrashBin(stat,M,4.95,-0.48);C.addBox(4.76,-0.67,5.14,-0.29,0,0.5,{tag:'muell'});

  // Westwand: Glas-Schaukasten, Bank, Uhr und offener zweiflügeliger Flurdurchgang.
  const pass={z0:F.portalZ-1,z1:F.portalZ+1};
  const passZ=F.portalZ,benchZ=-2.9;
  wall([F.x0,F.z1],[F.x0,F.recess.z],[{u:F.z1-pass.z1,w:2,y:0,h:3.15}]);
  pair('tuer_durchgang_west','Flurdurchgang',F.x0,passZ,Math.PI/2,2,false,true);
  stat.push(F.x0+0.2,0,benchZ,Math.PI/2);addSlatBench(stat,M,{length:1.85});stat.pop();
  C.addBox(F.x0,benchZ-0.97,F.x0+0.4,benchZ+0.98,0,0.45,{tag:'bank'});
  anchor('bank_foyer','bench','Bank im Foyer',F.x0+0.2,0,benchZ);
  noticeBoard(F.x0+0.035,1.75,benchZ+0.03,Math.PI/2,1.62,0.95,true);
  const clock=createWallClock(M);clock.position.set(F.x0+0.015,2.66,benchZ-0.87);clock.rotation.y=Math.PI/2;root.add(clock);
  registerObject('uhr_foyer','decoration','Wanduhr im Foyer',clock);
  stat.box(M.red,0.06,0.12,0.12,F.x0+0.04,1.22,benchZ+0.98);
  decal(M.fireAlarmFace,0.105,0.105,F.x0+0.072,1.22,benchZ+0.98,Math.PI/2);
  hangingExit(F.x0+0.45,H,passZ,Math.PI/2,'left');
  // Der anschließende Gang gehört zu flur1.js; gemeinsame Tür bleibt hier.

  // 0,8 Holz/Glas + 1,1 Tür + 1,1 massives Holz + 1,1 Tür + 1,2 Holz/Glas.
  partition([F.x0,F.recess.z],[F.recess.x,F.recess.z],[
    {center:1.35,id:'tuer_125',label:'125 · Future Lab',sign:M.foyerRoom125,hinge:'right',interactive:true},
    {center:3.55,id:'tuer_126',label:'126 · SMV',sign:M.foyerRoom126,hinge:'left',signRight:true}],[[1.9,3.0]],{seeThrough:true,lightRoom:'licht_futurelab'});
  partition([F.recess.x,F.recess.z],[F.recess.x,F.z0],[],[],{seeThrough:true,lightRoom:'licht_podcast'});
  partition([F.recess.x,F.z0],[4.65,F.z0],[{center:3.8,id:'tuer_027',label:'127 · Podcastraum',sign:M.foyerRoom127,hinge:'right',interactive:true}],[],{seeThrough:true,lightRoom:'licht_podcast'});
  stat.box(M.foyerWall,0.18,1.04,0.2,F.recess.x,2.78,F.z0);
  // Laut Nutzerfoto: Kummerkasten und Treppenhandlauf liegen an einer ebenen Wand.
  wall([4.65,F.z0],[F.stairX0,F.z0],[],{material:M.foyerWall});
  // Der obere Absatz öffnet sich jetzt in Flur 2; UG-Wand bleibt erhalten.
  // Wandfuge 3 mm unter dem Flur-2-Boden (y = 1,53): Oberkanten nicht in der Bodenfläche (Flackern).
  const seam=F.up.top-0.003;
  wall([F.stairX0,F.down.z0],[F.landingX1,F.down.z0],[],{y0:F.down.bottom,height:seam-F.down.bottom,material:M.foyerWall});
  wall([F.stairX0,F.down.z0],[9.25-0.003,F.down.z0],[],{y0:seam,height:F.stairCeiling-seam,material:M.flur2Wall});   // Putz wie Flur 2; Ende 3 mm in der Flur-2-Wand
  wall([F.stairX0,F.up.z1+0.002],[F.stairX0,F.z1]);   // 2 mm versetzt: Stirnseiten nicht in der Fläche der Treppenwand (Flackern)
  noticeBoard(1.78,1.63,F.z0+0.045,0,2.18,1.38,false);
  for(const [id,x,z] of [['foyer_obsttisch',-1.9,F.recess.z+0.4],['foyer_tisch_2',-0.94,F.recess.z+0.4]]){
    stat.push(x,0,z);addSchoolTable(stat,M,{width:0.92});stat.pop();
    C.addBox(x-0.46,z-0.3,x+0.46,z+0.3,0.716,0.76,{tag:'tisch',id});
    for(const s of [-1,1])C.addBox(x+s*0.37-0.03,z-0.27,x+s*0.37+0.03,z+0.27,0,0.72,{tag:'tisch'});
    map.furniture.push([x-0.46,z-0.3,x+0.46,z+0.3]);anchor(id,'table','Apfeltisch',x,0.76,z);
  }
  root.add(instancePrototype(createCrate({...M,crate:M.foyerWood}),[{x:-1.9,y:0.76,z:F.recess.z+0.4},{x:-0.94,y:0.76,z:F.recess.z+0.4}],'foyer_obstkisten'));
  for(let i=0;i<30;i++)stat.add(i%4?M.appleGreen:M.appleRed,new THREE.SphereGeometry(0.038,8,6),matrixFrom(-1.9+(i%2)*0.96+((i*13)%7-3)*0.045,0.84+(i%3)*0.025,F.recess.z+0.4+((i*7)%5-2)*0.045,0,0,0,1,0.9,1));
  stat.push(0.48,0,F.z0+0.35);addDepositBin(stat,M);stat.pop();
  C.addBox(0.21,F.z0+0.08,0.75,F.z0+0.61,0,1,{tag:'pfand'});
  anchor('foyer_pfand','decoration','Pfandsammelbehälter',0.48,0,F.z0+0.35);
  decal(M.depositPoster,0.28,0.4,0.4,1.65,F.z0+0.025);
  addSeating();
  // Metall-Kummerkasten und dreiteilige Schalterleiste neben Tür 027.
  stat.box(M.foyerFrame,0.34,0.35,0.09,5.08,1.72,F.z0+0.055);
  stat.box(M.switchWhite,0.30,0.29,0.012,5.08,1.71,F.z0+0.108);
  stat.box(M.foyerFrame,0.37,0.025,0.12,5.08,1.905,F.z0+0.06);
  decal(M.kummerkasten,0.27,0.085,5.08,1.77,F.z0+0.115);
  stat.cylinder(M.chrome,0.012,0.012,0.008,5.08,1.86,F.z0+0.12,10,Math.PI/2);
  decal(M.ugSign,0.38,0.09,5.6,1.83,F.z0+0.015);
  anchor('kummerkasten','decoration','Kummerkasten',5.08,1.72,F.z0+0.1);
  const sb=new PartBuilder();for(const y of [1.1,1,0.9])addSwitchPlate(sb,M,0,y,0,0,y===0.9);
  const sw=sb.build({name:'lichtschalter_foyer'});sw.position.set(4.98,0,F.z0+0.01);root.add(sw);
  interactions.register(sw,{id:'lichtschalter_foyer',type:'switch',label:()=>lighting.isOn('licht_flur')?'Foyerlicht ausschalten':'Foyerlicht einschalten',onInteract:()=>{lighting.toggle('licht_flur');audio.click();}});
  registerObject('lichtschalter_foyer','switch','Foyerlicht',sw);

  buildStairwell({F,M,C,root,stat,wall,floor,ceiling,decal,anchor,map,lamp});
  const lm={...M,lightPanel:M.lightPanelCorridor};
  for(const x of [-3.75,-1.25,1.25,3.75])for(const z of [F.z1-1.4,F.z0+1.4])addCeilingLight(lampGeo,lm,x,H,z,{length:1.2,width:0.13,ry:Math.PI/2});
  for(const [x,z] of [[-3.3,middleZ],[-0.1,middleZ-0.65],[3.5,middleZ]])lamp(x,H-0.35,z,12,6);
  // Gestreutes Tageslicht an der Glasfront, folgt der gewählten Tageszeit.
  lighting.addDaylight(root,'licht_flur',{position:[-2.6,2.4,0.35],intensity:12,distance:8});
  for(const x of [-2.5,2.5]){
    stat.cylinder(M.switchWhite,0.055,0.055,0.025,x,H-0.013,middleZ,16);
    stat.box(M.panelGrey,0.25,0.008,0.25,x,H-0.006,middleZ-0.6);
    for(let j=0;j<9;j++)stat.box(M.foyerFrame,0.21,0.003,0.005,x,H-0.011,middleZ-0.7+j*0.024);
  }
  lighting.addCircuit('licht_flur',{lights,panels:[M.lightPanelCorridor],on:true,
    regions:[[F.x0,F.z0-0.11,F.x1,-0.125,-10,3.54],[F.x0,F.recess.z-0.11,F.recess.x+0.11,F.z0-0.11,-10,3.54],
      ...returnStairRegions(false),[F.stairX0,F.down.z1,F.stairX1,F.up.z1,-10,FLUR3.y-.12],
      [F.stairX1,F.down.z0,F.landingX1+0.1,F.up.z1,-10,1.44]]});
  root.add(walls.build({name:'foyer_waende',castShadow:false}),stat.build({name:'foyer_ausstattung'}),lampGeo.build({name:'foyer_leuchten',castShadow:false}));
  root.traverse(o=>{
    if(o.isMesh&&(o.material===M.foyerPlaster||o.material===M.flur2Wall))metricBoxUV(o.geometry,0.65);
    if(o.isMesh&&o.material===M.stairBlue)metricBoxUV(o.geometry,0.48);
  });
  return {id:'flur_eg',name:'Foyer EG',root,
    bounds:{minX:F.x0-0.25,maxX:F.landingX1+0.25,minZ:F.recess.z-0.25,maxZ:-.125,maxY:F.stairCeiling},
    update(dt){updates.forEach(u=>u.update(dt));},
    areaName(p){
      if(p.y>=FLUR3.y-.12)return null;
      if(p.x>=F.stairX0&&p.x<F.stairX1&&p.z<F.down.z1&&p.y>F.up.top+.03)return null;
      if(p.x<F.x0-0.2||p.x>=F.stairX1&&p.y>1.44)return null;
      if(p.x>=F.recess.x+0.22&&p.z<F.z0-0.22)return null; // Rückseite der gemeinsamen Wand: Raum 127.
      if(p.z>F.z1||p.z<F.recess.z-0.3||p.x>F.landingX1+0.2)return null;
      if(p.y<-0.8)return 'Treppenhaus · UG-Absatz';
      if(p.x>F.stairX0)return p.y>1.2?'Treppenhaus · oberer Absatz':'Treppenhaus';return 'Foyer';
    }};

  function hangingExit(x,y,z,ry,direction){
    stat.push(x,y,z,ry);
    for(const s of [-1,1])stat.rod(M.steel,[s*0.1,0,0],[s*0.1,-0.3,0],0.005,6);
    stat.box(M.foyerFrame,0.37,0.19,0.055,0,-0.39,0);
    stat.box(M.lightPanelCorridor,0.32,0.008,0.045,0,-0.488,0);stat.pop();
    decal(M['foyerExit_'+direction],0.34,0.16,x+Math.sin(ry)*0.03,y-0.39,z+Math.cos(ry)*0.03,ry);
    const back=direction==='left'?'right':direction;
    decal(M['foyerExit_'+back],0.34,0.16,x-Math.sin(ry)*0.03,y-0.39,z-Math.cos(ry)*0.03,ry+Math.PI);
  }
  function pair(id,name,x,z,ry,width,entrance,open){
    open=false;   // Nutzerwunsch: beim Start sind alle Türen geschlossen
    const door=createDoubleDoor(M,{width,height:3.15,leafHeight:2.28,entrance});
    door.group.position.set(x,0,z);door.group.rotation.y=ry;door.group.name=id;root.add(door.group);
    const blocks=door.leaves.map(l=>C.add({x,z,w:l.width,d:0.065,bottom:0,top:door.leafHeight,tag:'tuer',id}));
    const point=new THREE.Vector3();
    const toggles=door.leaves.map((l,i)=>new Toggle({open:open&&i===1,duration:0.8,apply:k=>{
        l.pivot.rotation.y=(entrance?1:-1)*l.dir*1.37*k;door.group.updateMatrixWorld(true);
        point.set(l.centerX,0,0).applyMatrix4(l.pivot.matrixWorld);C.update(blocks[i],{x:point.x,z:point.z,rot:ry+l.pivot.rotation.y});
    }}));
    updates.push(...toggles);registerObject(id,'door',name,door.group);
    interactions.register(door.group,{id,type:'door',label:()=>`${name} ${toggles.some(t=>t.isOpen)?'schließen':'öffnen'}`,onInteract:()=>{
      const opening=!toggles.some(t=>t.isOpen);for(const t of toggles)if(t.isOpen!==opening)t.toggle();audio.door(opening);
    }});
    door.group.userData.initialLeafOpen=door.leaves.map((_,i)=>open&&i===1);
    if(entrance){
      const link={rooms:['licht_flur','licht_hof'],normal:[0,1]};
      door.leaves.forEach((l,i)=>lighting.portals.add({...link,id:id+'_'+i,
        center:[x-l.pivot.position.x-l.centerX,door.leafHeight/2,-.125],width:l.width,height:door.leafHeight,hinge:-l.dir,
        opening:()=>1-Math.cos(Math.min(Math.abs(l.pivot.rotation.y),Math.PI/2)),power:.22,range:3.3}));
      lighting.portals.add({...link,id:id+'_glas',center:[x,2.70,-.125],width:width-.12,height:.75,transmission:.5,power:.16,range:3.3});
    }
    if(id==='tuer_durchgang_west'){
      const link={rooms:['licht_flur1','licht_flur'],normal:[1,0]};
      door.leaves.forEach((l,i)=>lighting.portals.add({...link,id:id+'_'+i,
        center:[x,door.leafHeight/2,z-l.pivot.position.x-l.centerX],width:l.width,height:door.leafHeight,hinge:-l.dir,
        opening:()=>1-Math.cos(Math.min(Math.abs(l.pivot.rotation.y),Math.PI/2))}));
      lighting.portals.add({...link,id:id+'_oberlicht',center:[x,2.715,z],width:width-0.12,height:0.72,transmission:0.55,range:4.5});
    }
  }
  function partition(a,b,defs=[],solidUpper=[],{seeThrough=false,lightRoom=null}={}){
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),rot=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    const openings=defs.map(d=>({u:d.center-0.55,w:1.1,y:0,h:2.25}));
    // Beim ausgebauten Raum 127 liegt hinter dem Glas eine echte Wandöffnung.
    // Massive obere Holzfelder (125/126) bleiben erhalten; nur Glasfelder öffnen.
    const upperCuts=[0,...solidUpper.flat(),len].sort((x,y)=>x-y);
    const upperOpenings=seeThrough?upperCuts.slice(0,-1).flatMap((u,i)=>solidUpper.some(([a,b])=>u>=a&&upperCuts[i+1]<=b)?[]:[{u,w:upperCuts[i+1]-u,y:2.25,h:0.93}]):[];
    const normal=[-(b[1]-a[1])/len,(b[0]-a[0])/len];
    const portalCenter=(u,y)=>[a[0]+Math.cos(rot)*u-normal[0]*0.11,y,a[1]-Math.sin(rot)*u-normal[1]*0.11];
    if(lightRoom)upperOpenings.forEach((o,i)=>lighting.portals.add({
      id:`oberlicht_${a[0]}_${a[1]}_${i}`,rooms:[lightRoom,'licht_flur'],normal,
      center:portalCenter(o.u+o.w/2,2.715),width:o.w-0.035,height:0.885,transmission:0.5,range:4.5}));
    wall(a,b,[...openings,...upperOpenings],{material:M.foyerWood});stat.push(a[0],0,a[1],rot);
    const cuts=[0,...openings.flatMap(o=>[o.u,o.u+o.w]),len].sort((x,y)=>x-y);
    for(let i=0;i<cuts.length-1;i++){
      const start=cuts[i],end=cuts[i+1],n=Math.max(1,Math.ceil((end-start)/1.18));
      const solid=solidUpper.some(([a,b])=>start>=a-0.001&&end<=b+0.001);
      for(let k=0;k<n;k++){
        const x0=start+k*(end-start)/n,x1=start+(k+1)*(end-start)/n;
        if(!solid){
          if(seeThrough)stat.add(M.podcastGlass,new THREE.PlaneGeometry(x1-x0-0.035,0.885),matrixFrom((x0+x1)/2,2.715,-0.11));
          else stat.box(M.foyerGlass,x1-x0-0.045,0.85,0.015,(x0+x1)/2,2.72,0.02);
        }
        stat.box(M.foyerFrame,0.035,0.94,seeThrough?0.29:0.045,x0,2.72,seeThrough?-0.09:0.034);
        if(!openings.some(o=>x0>=o.u&&x1<=o.u+o.w))stat.box(M.crate,0.008,2.24,0.012,x0,1.12,0.012);
      }
      for(const y of solid?[3.18]:[2.25,3.18])stat.box(M.foyerFrame,end-start,0.045,seeThrough?0.29:0.06,(start+end)/2,y,seeThrough?-0.09:0.026);
    }
    stat.box(M.foyerFrame,0.035,0.94,seeThrough?0.29:0.045,len,2.72,seeThrough?-0.09:0.034);
    for(const o of openings)for(const u of [o.u,o.u+o.w]){
      stat.box(M.accentBlue,0.11,0.1,0.025,u,2.23,0.045);
      stat.box(M.foyerFrame,0.09,2.17,0.027,u,1.085,0.035);
      for(let y=0.04;y<2.16;y+=0.012)stat.box(M.aluminium,0.08,0.0015,0.003,u,y,0.051);
    }
    stat.pop();
    const ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
    for(const def of defs){
      const door=new Door(M,{id:def.id,name:def.label,width:0.98,openingWidth:1.1,openingHeight:2.25,leafHeight:2.18,transom:false,wallThickness:0.22,frontMaterial:M.foyerWood,backMaterial:M.foyerWood,leafMaterial:M.foyerWood,frameMaterial:M.foyerFrame,hinge:def.hinge,knob:true,knobBack:!def.interactive});
      door.group.position.set(a[0]+ux*def.center,0,a[1]+uz*def.center);door.group.rotation.y=rot;root.add(door.group);
      if(def.interactive){
        const block=C.add({x:0,z:0,w:0.97,d:0.065,rot,bottom:0,top:2.18,tag:'tuer',id:def.id});
        const point=new THREE.Vector3();
        const toggle=new Toggle({duration:0.8,apply:k=>{
          door.pivot.rotation.y=-1.65*k;door.group.updateMatrixWorld(true);
          door.leaf.getWorldPosition(point);C.update(block,{x:point.x,z:point.z,rot:rot+door.pivot.rotation.y});
        }});
        updates.push(toggle);door.group.userData.toggle=toggle;
        if(lightRoom)lighting.portals.add({id:def.id,rooms:[lightRoom,'licht_flur'],normal,
          center:portalCenter(def.center,1.09),width:0.98,height:2.18,hinge:def.hinge==='right'?1:-1,
          opening:()=>1-Math.cos(Math.min(Math.abs(door.pivot.rotation.y),Math.PI/2))});
        interactions.register(door.group,{id:def.id,type:'door',label:()=>`${def.label} ${toggle.isOpen?'schließen':'öffnen'}`,
          onInteract:()=>{audio.door(toggle.toggle());}});
        // Zargen bleiben auch bei geöffnetem Türblatt feste Hindernisse.
        for(const side of [-1,1])C.add({x:door.group.position.x+ux*side*0.52+uz*0.11,z:door.group.position.z+uz*side*0.52-ux*0.11,w:0.06,d:0.26,rot,bottom:0,top:2.25,tag:'zarge'});
        C.add({x:door.group.position.x+uz*0.11,z:door.group.position.z-ux*0.11,w:1.1,d:0.22,rot,bottom:2.25,top:H,tag:'wand'});
      }else C.add({x:door.group.position.x,z:door.group.position.z,w:1.1,d:0.25,rot,bottom:0,top:2.25,tag:'tuer',id:def.id});
      registerObject(def.id,'door',def.label,door.group);
      const u=def.center+(def.signRight?0.78:-0.78);
      decal(def.sign,0.2,0.175,a[0]+ux*u-uz*0.06,1.57,a[1]+uz*u+ux*0.06,rot);
      stat.push(a[0]+ux*u,1.57,a[1]+uz*u,rot);
      for(const x of [-0.082,0.082])for(const y of [-0.07,0.07])stat.cylinder(M.chrome,0.008,0.008,0.012,x,y,0.058,8,Math.PI/2);stat.pop();
      if(def.id==='tuer_125'){
        const poster=new THREE.Mesh(new THREE.PlaneGeometry(0.27,0.4),M.futureLabNotice);
        poster.position.set(0,0.43,0.025);poster.userData.interactionId=def.id;door.leaf.add(poster);
      }
    }
  }
  function noticeBoard(x,y,z,ry,w,h,glass){
    stat.push(x,y,z,ry);stat.box(glass?M.schoolTop:M.foyerCork,w,h,0.035,0,0,0.02);
    for(const s of [-1,1]){
      stat.box(M.foyerFrame,0.018,h+0.035,0.06,s*w/2,0,0.035);stat.box(M.foyerFrame,w+0.035,0.018,0.06,0,s*h/2,0.035);
    }
    const sheets=[[glass?M.schaukasten:M.pinnwand,0,0,w-0.025,h-0.025]];
    for(const [mat,sx,sy,sw,sh] of sheets){
      stat.add(mat,new THREE.PlaneGeometry(sw,sh),matrixFrom(sx,sy,0.041));
      if(mat===M.paper)for(let j=0;j<9;j++)stat.box(M.foyerFrame,sw*0.74,0.002,0.001,sx,sy+sh*0.28-j*0.018,0.043);
    }
    if(glass)stat.box(M.glass,w-0.03,h-0.03,0.004,0,0,0.065);stat.pop();
  }

  function addSeating(){
    for(const [id,x,mat] of [['erasmus_links',1.5,M['erasmus-links']],['erasmus_rechts',0.1,M['erasmus-rechts']]]){
      stat.push(x,0,-0.3,Math.PI);addMobileBoard(stat,M,mat);stat.pop();
      C.addBox(x-0.7,-0.36,x+0.7,-0.24,0,2.08,{tag:'stellwand',id});
      anchor(id,'decoration','Mobile Erasmus-Tafel',x,0,-0.3);
      map.furniture.push([x-0.7,-0.58,x+0.7,-0.02]);
    }
    const furniture=(id,x,z,ry,w,d,h,draw,bottom=0)=>{
      stat.push(x,0,z,ry);draw();stat.pop();
      C.add({x,z,w,d,rot:ry,bottom,top:h,tag:'moebel',id});
      const hx=(Math.abs(Math.cos(ry))*w+Math.abs(Math.sin(ry))*d)/2;
      const hz=(Math.abs(Math.sin(ry))*w+Math.abs(Math.cos(ry))*d)/2;
      map.furniture.push([x-hx,z-hz,x+hx,z+hz]);anchor(id,'furniture','Foyer-Sitzmöbel',x,0,z);
    };
    for(const [id,x,z,ry,length,mat] of [['lounge',0.65,-1.5,0,1.7,M.stoolGreen],['west',-4.02,-2.8,Math.PI/2,1.55,M.stoolBrown]]){
      const offset=(u,v)=>[x+Math.cos(ry)*u+Math.sin(ry)*v,z-Math.sin(ry)*u+Math.cos(ry)*v];
      furniture('hochtisch_'+id,x,z,ry,length,0.6,1.06,()=>addHighTable(stat,M,{length}));
      const [bx,bz]=offset(0,0.64*(id==='lounge'?1:-1));
      furniture('hochbank_'+id,bx,bz,ry,length,0.4,0.74,()=>addHighSeat(stat,M,{length,material:mat}));
      for(const s of [-1,1]){
        const [sx,sz]=offset(s*0.49,0.65*(id==='lounge'?-1:1));
        const seat=s<0?(id==='west'?M.stoolNavy:M.stoolGreen):(id==='west'?M.stoolGreen:M.stoolBrown);
        furniture('hocker_'+id+'_'+s,sx,sz,ry,0.42,0.4,0.74,()=>addHighSeat(stat,M,{material:seat}));
      }
    }
  }
}

function buildStairwell({F,M,C,root,stat,wall,floor,ceiling,decal,anchor,map,lamp}){
  const a=F.stairX0,b=F.stairX1,e=F.landingX1,mid=(F.down.z1+F.up.z0)/2,n=10,y=F.down.bottom;
  const downZ=(F.down.z0+F.down.z1)/2,upZ=(F.up.z0+F.up.z1)/2;
  // Enden 2 mm in der Foyerwand bei x = 5,6 (sonst gleiche Ebene wie deren Seitenfläche → Flackern)
  // Fuge 3 mm unter dem Flur-2-Boden (y = 1,53), sonst liegen die Wandoberkanten in der Bodenfläche.
  const seam=F.up.top-0.003;
  wall([e,F.up.z1],[a+0.002,F.up.z1],[],{y0:2*y,height:seam-2*y,material:M.foyerWall});
  wall([b-0.003,F.up.z1],[a+0.002,F.up.z1],[],{y0:seam,height:F.stairCeiling-seam,material:M.foyerWall});   // Anfang 3 mm in der Flur-2-Wand
  wall([e,F.down.z0],[e,F.up.z1],[],{y0:y,height:seam-y,material:M.foyerWall});
  // Das offene Treppenauge und die obere Untersicht werden von Flur 3 gebaut.
  // Vom neuen Flur aus sieht man über die niedrigere Foyerdecke: Stirnfläche schließen.
  // Nur 3 mm dick: Unterseite lag sonst 20 cm breit in der Foyerdecke (Flackern).
  stat.box(M.foyerWall,0.003,FLUR3.y-.12-F.height,F.up.z1-F.down.z1,a-0.0015,(FLUR3.y-.12+F.height)/2,(F.up.z1+F.down.z1)/2);
  C.addBox(a-0.2,F.down.z1,a,F.up.z1,F.height,FLUR3.y-.12,{tag:'wand'});
  flight(a,b,F.up.z0,F.up.z1,0,F.up.top,M.stairBlue,M.stairYellow,'treppe_foyer_hoch');
  flight(a,b,F.down.z0,F.down.z1,0,y,M.stairGrey,M.lineDark,'treppe_foyer_runter');
  floor(b,F.down.z0,e,F.up.z1,y,M.purpleFloor);
  // Boden des oberen Absatzes wird von Flur 2 gebaut.
  ceiling(b,F.down.z0,e,F.up.z1,F.up.top-0.18,M.ceilingPlain);
  // Der zuvor abgeschlossene Rücklauf wird begehbar von flur3.js gebaut.
  rail(a,b,mid,0,F.up.top);rail(a,b,mid-0.07,0,y);
  C.add({x:(a+b)/2,z:mid,w:0.13,d:b-a+0.12,rot:Math.PI/2,bottom:y,slope:{h0:1.05,h1:F.up.top+1.05},tag:'gelaender'});
  stat.box(M.perforated,0.028,0.75,0.42,a+0.04,0.43,mid);
  stat.rod(M.handrailWood,[a-0.03,1.05,mid-0.27],[a-0.03,1.05,mid+0.27],0.03,12);
  C.addBox(a-0.04,mid-0.23,a+0.08,mid+0.23,0,1.07,{tag:'gelaender'});
  for(const [z,h1] of [[F.down.z0+0.09,y],[F.up.z1-0.09,F.up.top]]){
    stat.rod(M.handrailWood,[a-0.28,0.9,z],[b,h1+0.9,z],0.027,12);
    for(let i=0;i<4;i++){
      const x=a+i*(b-a)/3,yy=h1*i/3+0.87;
      stat.rod(M.foyerFrame,[x,yy,z],[x,yy-0.08,z+(z<mid?-0.07:0.07)],0.012,6);
    }
  }
  // Grauer Wandsockel mit steigender Oberkante auf der rechten Treppenseite.
  const shape=new THREE.Shape([new THREE.Vector2(a,0),new THREE.Vector2(a,0.95),new THREE.Vector2(b,F.up.top+0.95),new THREE.Vector2(b,F.up.top)]);
  const dg=new THREE.ShapeGeometry(shape),idx=dg.index;
  // ShapeGeometry richtet alle Flächen nach +z aus; hier wird -z benötigt.
  for(let i=0;i<idx.count;i+=3){const v=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,v);}dg.computeVertexNormals();
  const dado=new THREE.Mesh(dg,M.dado);dado.position.z=F.up.z1-0.01;root.add(dado);
  // UG-Absatz: Schließfächer an der Nordwand, Bild und Sammelbehälter gegenüber der Treppe.
  const lx=b+0.18,lw=e-b-0.28;
  for(let col=0;col<8;col++)for(let row=0;row<3;row++){
    const w=lw/8,x=lx+(col+0.5)*w,yy=y+0.16+(row+0.5)*0.49;
    stat.box(M.foyerWood,w-0.006,0.484,0.42,x,yy,F.down.z0+0.23);
    stat.cylinder(M.steel,0.012,0.012,0.008,x-w*0.3,yy+0.08,F.down.z0+0.445,8,Math.PI/2);
  }
  for(const x of [lx+0.05,lx+lw/2,lx+lw-0.05])stat.box(M.blueSteel,0.035,0.17,0.35,x,y+0.085,F.down.z0+0.22);
  stat.box(M.switchWhite,0.025,1.49,0.43,lx-0.013,y+0.905,F.down.z0+0.23);
  C.addBox(lx,F.down.z0,lx+lw,F.down.z0+0.46,y,y+1.63,{tag:'schrank'});
  anchor('schliessfaecher_ug','cabinet','Schließfächer am UG-Absatz',lx+lw/2,y,F.down.z0+0.2);
  decal(M.paintingMat,0.85,0.7,e-0.018,y+1.55,downZ+0.055,-Math.PI/2);
  stat.box(M.greenBox,0.28,1.05,0.7,e-0.22,y+0.525,-1.4);stat.box(M.steelBlack,0.38,0.05,0.78,e-0.24,y+1.08,-1.4);
  decal(M.batteryLabel,0.5,0.7,e-0.37,y+0.7,-1.4,-Math.PI/2);C.addBox(e-0.45,-1.75,e,-1.05,y,y+1.1,{tag:'kiste'});
  // Sichtbarer zweiter Abgang aus „flur-treppen runter“: Rücklauf unter dem Aufgang.
  flight(a,b,F.up.z0,F.up.z1,2*y,y,M.stairGrey,M.lineDark,'treppe_foyer_ug_ruecklauf');
  rail(a,b,mid,2*y,y);
  C.add({x:(a+b)/2,z:mid,w:0.13,d:b-a,rot:Math.PI/2,bottom:2*y,slope:{h0:2*y+1.05,h1:y+1.05},tag:'gelaender'});
  stat.box(M.perforated,0.3,0.75,0.028,b-0.04,y+0.43,mid);
  stat.rod(M.handrailWood,[b+0.2,y+1.05,mid],[b-0.32,y+1.05,mid],0.03,12);
  stat.rod(M.handrailWood,[a,2*y+0.9,F.up.z1-0.09],[b+0.2,y+0.9,F.up.z1-0.09],0.027,12);
  const lowerEnd=a-1.4;
  floor(lowerEnd,F.up.z0,a,F.up.z1,2*y,M.purpleFloor);
  ceiling(lowerEnd,F.up.z0,a,F.up.z1,-0.18,M.ceilingPlain);
  wall([a,F.up.z0],[lowerEnd,F.up.z0],[],{y0:2*y,height:-0.18-2*y,noMap:true});
  wall([lowerEnd,F.up.z0],[lowerEnd,F.up.z1],[],{y0:2*y,height:-0.18-2*y,noMap:true});
  wall([lowerEnd,F.up.z1],[a,F.up.z1],[],{y0:2*y,height:-0.18-2*y,noMap:true});
  // Unter dem ersten Abgang war der Raum offen bis auf den Außenboden: Boden auf UG-Höhe,
  // Wand neben dem zweiten Abgang (Oberkante 3 mm unter diesem Boden) und Stirnwand unter dem Foyer.
  const under=F.up.z0;   // Wand direkt an der Stufenkante des zweiten Abgangs
  floor(a,F.down.z0,b,under,y,M.purpleFloor);
  wall([a,under],[b,under],[],{y0:2*y,height:-y-0.003,noMap:true,material:M.foyerWall});
  wall([a,under],[a,F.down.z0],[],{y0:y,height:-y-0.1,noMap:true,material:M.foyerWall});
  lamp(lowerEnd+0.8,-0.5,upZ,1.5,5);
  anchor('treppe_foyer_ug_ruecklauf','stairs','Weiterer Abgang ins UG',b,y,upZ);
  stat.box(M.lightPanelCorridor,0.5,0.025,0.5,b+0.95,F.up.top-0.21,mid-0.44);
  lamp(b+0.95,F.up.top-0.32,mid-0.44,2.5,5);
  for(const [id,name,z0,z1] of [['treppe_foyer_hoch','Treppe nach oben',F.up.z0,F.up.z1],['treppe_foyer_runter','Treppe zum UG',F.down.z0,F.down.z1]]){
    anchor(id,'stairs',name,a,0,(z0+z1)/2);map.areas.push({poly:[[a,z0],[b,z0],[b,z1],[a,z1]],fill:'rgba(140,155,180,0.3)'});
    map.labels.push({text:id.endsWith('hoch')?'↑':'↓ UG',x:(a+b)/2,z:(z0+z1)/2});
  }
  function flight(x0,x1,z0,z1,h0,h1,mat,nose,id,overhead=false){
    const going=(x1-x0)/n,rise=(h1-h0)/n;
    for(let i=0;i<n;i++){
      const top=h0+rise*(rise>0?i+1:i),x=x0+i*going,edge=rise>0?x:x+going-0.035;
      stat.boxMinMax(mat,x,top-Math.abs(rise)-0.025,z0+0.025,x+going,top,z1-0.025);
      stat.box(nose,0.035,0.005,z1-z0-0.05,edge+0.0175,top+0.002,(z0+z1)/2);
      // Gelbe Setzstufen-Kante 1 mm vor der Stufenfront (bündig flackerte sie).
      if(nose===M.stairYellow)stat.box(nose,0.006,0.023,z1-z0-0.05,edge+(rise>0?0.002:0.003),top-0.008,(z0+z1)/2);
    }
    const shape=new THREE.Shape([new THREE.Vector2(x0,h0-0.2),new THREE.Vector2(x1,h1-0.2),new THREE.Vector2(x1,h1),new THREE.Vector2(x0,h0)]);
    const g=new THREE.ExtrudeGeometry(shape,{depth:z1-z0,bevelEnabled:false});g.translate(0,0,z0);stat.add(M.ceilingPlain,g);
    if(overhead){
      for(let i=0;i<n;i++){
        const xa=x0+i*going,ya=h0+rise*i,yb=ya+rise;
        C.addBox(xa,z0,xa+going,z1,Math.min(ya,yb)-0.2,Math.max(ya,yb),{tag:'decke'});
      }
    }else{
      // Dünne Rampenabschnitte lassen unter dem Aufgang Platz für den UG-Rücklauf.
      for(let i=0;i<n;i++){
        const xa=x0+i*going,ya=h0+rise*i,yb=ya+rise;
        C.add({x:xa+going/2,z:(z0+z1)/2,w:z1-z0,d:going,rot:Math.PI/2,bottom:Math.min(ya,yb)-0.2,slope:{h0:ya,h1:yb},tag:'treppe',surface:'rubber',id});
      }
    }
  }
  function rail(x0,x1,z,h0,h1){
    for(let i=0;i<=3;i++){const t=i/3;stat.box(M.foyerFrame,0.04,1.02,0.04,x0+t*(x1-x0),h0+t*(h1-h0)+0.51,z);}
    for(let i=1;i<=5;i++)stat.rod(i===3?M.redSteel:M.blueSteel,[x0,h0+i*0.16,z],[x1,h1+i*0.16,z],0.006,8);
    stat.rod(M.handrailWood,[x0-0.08,h0+1.04,z],[x1+0.02,h1+1.04,z],0.028,12);
  }
}

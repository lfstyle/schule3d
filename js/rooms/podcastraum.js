// Raum 127 / ehemaliger Abstellraum: alle 17 Referenzen in fotos/podcast-raum.
// Modellierungsmaße, keine Vermessung. Tür und gemeinsame Foyerwand bleiben in flur.js.
import * as THREE from 'three';
import { PartBuilder, matrixFrom, instancePrototype } from '../geometry.js';
import { addWall, addWindow, addCeilingLight, addSwitchPlate, addVerticalRadiator, createChair, addSchoolTable } from '../objects.js';
import { addCable, addStudioDesk, addMonitor, addKeyboard, addComputerTower, addStudioTripod,
  addSoftbox, addHeadphones, addMicrophoneArm, addMixer, addOfficeChair, addCubeShelf } from '../podcast-objects.js';
import { FOYER } from './flur.js';

export const PODCAST={
  west:FOYER.recess.x+0.22,east:9.0,north:-10.27,south:FOYER.z0-0.22,height:FOYER.height,
  doorX:3.9,doorZ:FOYER.z0,
  pier:{x0:4.6,x1:5.2,depth:0.18},
};

export function buildPodcastraum(ctx){
  const {scene,collision:C,materials:M,registerObject,interactions,lighting,audio,map}=ctx;
  const P=PODCAST,H=P.height,N=P.north,S=P.south;
  const root=new THREE.Group();root.name='podcastraum';scene.add(root);
  const b=new PartBuilder(),walls=new PartBuilder(),fixtures=new PartBuilder(),lights=[];
  const wallM={...M,baseboard:M.podcastFelt};
  const anchor=(id,type,name,x,y,z)=>{
    const o=new THREE.Object3D();o.position.set(x,y,z);root.add(o);registerObject(id,type,name,o);return o;
  };
  const block=(id,x,z,w,d,h,tag='moebel',bottom=0)=>{
    C.add({x,z,w,d,bottom,top:h,tag,id});map.furniture.push([x-w/2,z-d/2,x+w/2,z+d/2]);
  };
  const wall=(a,c,openings=[])=>{
    const r=addWall(walls,wallM,{start:a,end:c,height:H,thickness:0.2,openings,material:M.foyerWall});
    r.colliders.forEach(v=>C.add({...v,tag:'wand'}));map.walls.push(...r.segments);
  };
  const surface=(material,x0,z0,x1,z1,y,down=false,tile=0.6)=>{
    const g=new THREE.PlaneGeometry(x1-x0,z1-z0);g.rotateX(down?Math.PI/2:-Math.PI/2);
    const p=g.attributes.position,uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(p.getX(i)+(x0+x1)/2)/tile,(p.getZ(i)+(z0+z1)/2)/tile);
    const o=new THREE.Mesh(g,material);o.position.set((x0+x1)/2,y,(z0+z1)/2);o.receiveShadow=true;root.add(o);return o;
  };
  surface(M.podcastFloor,P.west,N,P.east,S,0);
  C.addBox(P.west,N,P.east,S,-0.18,0,{tag:'boden',surface:'tile'});
  // Durchgehende Schwelle über die 22 cm tiefe vorhandene Wandöffnung.
  surface(M.podcastFloor,P.doorX-0.55,S,P.doorX+0.55,P.doorZ,0);
  C.addBox(P.doorX-0.55,S,P.doorX+0.55,P.doorZ,-0.18,0,{tag:'boden',surface:'tile'});
  b.box(M.aluminium,1.07,0.008,0.035,P.doorX,0.004,P.doorZ-0.03);
  surface(M.podcastCeiling,P.west,N,P.east,S,H,true);
  C.addBox(P.west,N,P.east,S,H,H+0.16,{tag:'decke'});
  surface(M.foyerRoof,P.west,N,P.east,S,H+0.17).castShadow=true;

  // Neuer Außenumfang. Südwand und das südliche Stück der Westwand existieren bereits.
  wall([P.west,FOYER.recess.z],[P.west,N],[{u:0.2,w:1.65,y:2.13,h:0.97}]);
  wall([P.west,N],[P.pier.x0,N]);
  wall([P.pier.x0,N],[P.pier.x0,N+P.pier.depth]);
  wall([P.pier.x0,N+P.pier.depth],[P.pier.x1,N+P.pier.depth]);
  wall([P.pier.x1,N+P.pier.depth],[P.pier.x1,N]);
  wall([P.pier.x1,N],[P.east,N]);
  wall([P.east,N],[P.east,S]);
  b.push(P.west,2.615,FOYER.recess.z-1.025,Math.PI/2);
  addWindow(b,M,{w:1.65,h:0.97,inset:0.1,frame:M.partitionFrame,glass:M.foyerWireGlass,rows:[{f:1,cols:1}],sill:false,frameT:0.035});b.pop();

  // Rückseite der bestehenden Holz-/Glasfront, ohne zweite Wand oder zweite Tür.
  const cuts=[FOYER.recess.x,3.35,4.45,4.65];
  for(let i=0;i<cuts.length-1;i++){
    const a=cuts[i],c=cuts[i+1],count=Math.max(1,Math.ceil((c-a)/1.18));
    for(let j=0;j<count;j++){
      const x=a+(j+0.5)*(c-a)/count,w=(c-a)/count;
      // Die gemeinsame transparente Scheibe wird nur einmal in flur.js gebaut.
      b.box(M.partitionFrame,0.035,0.94,0.04,x-w/2,2.72,S-0.025);
    }
    for(const y of [2.25,3.18])b.box(M.partitionFrame,c-a,0.045,0.045,(a+c)/2,y,S-0.025);
  }
  for(const x of [3.35,4.45]){
    b.box(M.partitionFrame,0.07,2.25,0.03,x,1.125,S-0.02);
    b.box(M.accentBlue,0.1,0.1,0.025,x,2.23,S-0.04);
  }
  // Akustiklamellen: echtes schmales Relief auf dunklem Filz, kein flaches Streifenbild.
  const panel=(a,c,height=2.86)=>{
    const len=Math.hypot(c[0]-a[0],c[1]-a[1]),ry=-Math.atan2(c[1]-a[1],c[0]-a[0]);
    b.push(a[0],0,a[1],ry);
    b.box(M.podcastFelt,len,height-0.07,0.015,len/2,(height+0.07)/2,0.01);
    const count=Math.floor(len/0.042),pitch=len/count;
    for(let i=0;i<count;i++)b.box(M.podcastSlat,0.028,height-0.09,0.023,(i+0.5)*pitch,(height+0.09)/2,0.029);
    b.box(M.podcastFelt,len,0.07,0.035,len/2,0.035,0.018);b.pop();
  };
  panel([1.9,N],[P.pier.x0,N]);
  panel([P.pier.x0,N],[P.pier.x0,N+P.pier.depth]);
  panel([P.pier.x0,N+P.pier.depth],[P.pier.x1,N+P.pier.depth]);
  panel([P.pier.x1,N+P.pier.depth],[P.pier.x1,N]);
  panel([P.pier.x1,N],[P.east,N]);panel([P.east,N],[P.east,S]);
  panel([P.east,S],[4.65,S]); // endet an der Holzfront, nicht im schmalen Oberlicht
  // Weiße Installationsleiste an der Aufnahme-Wand, einzelne Steckdosen und Kabel.
  b.box(M.duct,6.95,0.14,0.055,5.4,0.98,N+0.065);
  for(const x of [2.15,5.65,6.4,7.0,8.5]){
    addSwitchPlate(b,M,x,0.98,N+0.096,0,true);
    addSwitchPlate(b,M,x+0.09,0.98,N+0.096,0,true);
  }
  const switchParts=new PartBuilder();addSwitchPlate(switchParts,M,0,1.08,0,Math.PI);
  addSwitchPlate(switchParts,M,0,0.98,0,Math.PI,true);
  const sw=switchParts.build({name:'lichtschalter_podcast'});sw.position.set(3.18,0,S-0.01);root.add(sw);
  registerObject('lichtschalter_podcast','switch','Podcastraumlicht',sw);
  interactions.register(sw,{id:'lichtschalter_podcast',type:'switch',label:()=>lighting.isOn('licht_podcast')?'Podcastraumlicht ausschalten':'Podcastraumlicht einschalten',onInteract:()=>{lighting.toggle('licht_podcast');audio.click();}});

  buildGreenScreen();
  // Zwei Softboxen zeigen zum Greenscreen. Der mittlere Laufweg bleibt frei.
  for(const [id,x,z,ry] of [['links',2.63,S-0.46,-1.9],['rechts',2.67,N+0.58,-1.2]]){
    b.push(x,0,z,ry);addSoftbox(b,M);b.pop();block('podcast_softbox_'+id,x,z,0.38,0.38,2.2);
    anchor('podcast_softbox_'+id,'equipment','Softbox',x,1.9,z);
  }
  b.push(3.18,0,N+1.0,-Math.PI/2);addStudioTripod(b,M,{height:1.38,spread:0.32,camera:true});b.pop();
  block('podcast_stativ',3.18,N+1.0,0.28,0.28,1.45);anchor('podcast_stativ','equipment','Kamerastativ',3.18,0,N+1.0);
  b.push(2.88,0,N+0.39);addSchoolTable(b,{...M,schoolRed:M.blueSteel},{width:0.95,depth:0.58});b.pop();
  deskCollision('podcast_videotisch',2.88,N+0.39,0.95,0.58);
  b.push(2.88,0.76,N+0.29);addMonitor(b,M,{width:0.58,height:0.33});b.pop();
  b.push(2.83,0.76,N+0.53);addKeyboard(b,M);b.pop();
  b.push(2.9,0,N+0.37);addComputerTower(b,M);b.pop();
  b.cylinder(M.podcastPlastic,0.036,0.031,0.16,3.25,0.84,N+0.49,14);

  buildShelf();
  // L-förmiger Arbeits-/Aufnahmeplatz rechts der Tür.
  b.push(5.9,0,N+0.47);addStudioDesk(b,M,{width:2.5,depth:0.72});b.pop();
  deskCollision('podcast_pc_tisch',5.9,N+0.47,2.5,0.72);
  b.push(7.55,0,-8.77,Math.PI/2);addStudioDesk(b,M,{width:1.9,depth:0.8});b.pop();
  deskCollision('podcast_aufnahmetisch',7.55,-8.77,0.8,1.9);
  b.push(5.78,0.75,N+0.3);addMonitor(b,M,{width:0.69,height:0.41});b.pop();
  b.push(5.72,0.75,N+0.65);addKeyboard(b,M);b.pop();
  b.push(6.72,0.75,N+0.44);addComputerTower(b,M);b.pop();
  b.box(M.podcastPlastic,0.13,0.015,0.04,6.72,1.17,N+0.42);
  for(let i=0;i<3;i++)b.box(M.podcastStorage,0.27,0.12,0.32,5.12,0.81+i*0.12,N+0.36);
  b.box(M.stoolNavy,0.31,0.025,0.3,5.12,1.12,N+0.36);
  for(let i=0;i<3;i++)b.box(M.podcastYellow,0.015,0.002,0.015,5.05+i*0.05,1.134,N+0.36);
  b.push(7.5,0.75,-9.25);addMixer(b,M);b.pop();
  anchor('podcast_mischpult','equipment','Podcast-Mischpult',7.5,0.75,-9.25);
  const arms=[[7.15,-9.48,0.6,0.42],[7.14,-8.7,1.2,0.48],[7.17,-7.96,1.55,0.42]];
  for(let i=0;i<arms.length;i++){
    const [x,z,angle,reach]=arms[i];b.push(x,0.75,z);addMicrophoneArm(b,M,{angle,reach});b.pop();
    anchor('podcast_mikrofon_'+(i+1),'equipment','Mikrofon am Gelenkarm',x,0.75,z);
  }
  for(const [x,z] of [[7.62,-9.45],[7.62,-8.75],[7.62,-8.1]]){
    b.push(x,0.75,z,0.5);addHeadphones(b,M);b.pop();
    addCable(b,M,[[x,0.775,z],[x-0.25,0.775,z+0.1],[7.22,0.77,-9.0],[7.2,0.2,-9.1],[6.9,0.015,-9.3]]);
  }
  b.cylinder(M.chrome,0.042,0.05,0.01,7.62,0.756,-8.6,16);
  b.cylinder(M.chrome,0.009,0.009,0.055,7.62,0.787,-8.6,12);
  for(const [i,z] of [-9.5,-8.1].entries()){
    b.push(8.48,0,z,-Math.PI/2);addOfficeChair(b,M);b.pop();
    block('podcast_drehstuhl_'+i,8.48,z,0.48,0.48,1.05);anchor('podcast_drehstuhl_'+i,'chair','Schwarzer Drehstuhl',8.48,0,z);
  }
  const chairs=[{x:5.8,z:N+1.22,ry:Math.PI},{x:5.3,z:S-0.42,ry:0}];
  root.add(instancePrototype(createChair(M),chairs,'podcast_stoffstuehle'));
  chairs.forEach((p,i)=>{block('podcast_stoffstuhl_'+i,p.x,p.z,0.43,0.48,0.88);anchor('podcast_stoffstuhl_'+i,'chair','Grauer Stoffstuhl',p.x,0,p.z);});
  b.push(8.4,0,S-0.01,Math.PI);addVerticalRadiator(b,M,{width:0.43,height:1.55,y0:0.1});b.pop();
  block('podcast_heizung',8.4,S-0.075,0.48,0.15,1.65);anchor('podcast_heizung','radiator','Hoher Heizkörper',8.4,0,S);
  // Monitorkabel von der Tower-Rückseite entlang der hinteren Tischkante.
  // Alle Punkte liegen über der Platte; keine Schlaufen durch Tisch oder Laufweg.
  addCable(b,M,[[6.72,1.0,N+0.243],[6.7,0.9,N+0.18],[6.52,0.78,N+0.16],
    [6.16,0.78,N+0.16],[5.9,0.79,N+0.16],[5.78,0.91,N+0.18],[5.78,1.1,N+0.241]],0.004);

  // Drei breite Rasterleuchten, weißes Deckenraster und kleine runde Einbauten.
  for(const x of [1.65,4.55,7.45]){
    addCeilingLight(fixtures,{...M,lightPanel:M.podcastLight},x,H,(N+S)/2,{length:1.2,width:0.6});
    const l=new THREE.SpotLight(0xfff7ec,23,5,1.05,0.75,2);
    l.position.set(x,H-0.08,(N+S)/2);l.target.position.set(x,0,(N+S)/2);root.add(l,l.target);lights.push(l);
  }
  for(const x of [2.8,3.4,5.8,6.3])fixtures.cylinder(M.switchWhite,0.055,0.055,0.02,x,H-0.01,(N+S)/2-0.35,16);
  fixtures.box(M.panelGrey,0.3,0.012,0.3,3.55,H-0.006,(N+S)/2+0.28);
  for(let i=0;i<12;i++)fixtures.box(M.baseboard,0.25,0.006,0.005,3.55,H-0.015,(N+S)/2+0.16+i*0.022);
  lighting.addCircuit('licht_podcast',{lights,panels:[M.podcastLight],on:true,regions:[[P.west-0.11,N-0.05,P.east+0.05,FOYER.z0-0.11]]});
  lighting.addDaylight(root,'licht_podcast',{position:[4.5,2.6,S+0.5],intensity:2,distance:5});
  root.add(walls.build({name:'podcast_waende',castShadow:false}),b.build({name:'podcast_ausstattung'}),fixtures.build({name:'podcast_leuchten',castShadow:false}));
  map.areas.push({poly:[[P.west,S],[P.west,N],[P.pier.x0,N],[P.pier.x0,N+P.pier.depth],[P.pier.x1,N+P.pier.depth],[P.pier.x1,N],[P.east,N],[P.east,S]],fill:'rgba(170,145,95,0.16)'});
  map.labels.push({text:'127 · Podcast',x:5.3,z:-8.5});
  return {id:'podcastraum',name:'Podcastraum 127',root,
    bounds:{minX:P.west-0.2,maxX:P.east+0.2,minZ:N-0.2,maxZ:S,maxY:H+0.2},
    areaName:p=>p.x>=P.west&&p.x<=P.east&&p.z>=N&&p.z<S+0.01&&p.y>-0.2&&p.y<H?'Podcastraum · 127':null};

  function deskCollision(id,x,z,w,d){
    block(id,x,z,w,d,0.76,'tisch',0.7);
    for(const sx of [-1,1])for(const sz of [-1,1])C.addBox(x+sx*(w/2-0.12)-0.03,z+sz*(d/2-0.1)-0.03,x+sx*(w/2-0.12)+0.03,z+sz*(d/2-0.1)+0.03,0,0.72,{tag:'tisch',id});
    anchor(id,'table','Studiotisch',x,0,z);
  }
  function buildGreenScreen(){
    const mid=(N+S)/2,z0=N+0.22,z1=S-0.22;
    const g=new THREE.PlaneGeometry(z1-z0,2.12,48,24),p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const u=p.getX(i),v=p.getY(i);
      // U-förmiger textiler Hintergrund mit kleinen, unregelmäßigen Falten.
      const x=1.02+0.32*Math.pow(Math.abs(u)/((z1-z0)/2),5)+0.013*Math.sin(u*28+v*3)+0.008*Math.sin(u*51-v*4);
      p.setXYZ(i,x,v+1.12,mid+u);
    }
    g.computeVertexNormals();b.add(M.podcastGreen,g);
    const points=[];for(let i=0;i<=12;i++){const u=(i/12-0.5)*(z1-z0);points.push([1.02+0.32*Math.pow(Math.abs(u)/((z1-z0)/2),5),2.21,mid+u]);}
    for(let i=1;i<points.length;i++)b.rod(M.podcastPlastic,points[i-1],points[i],0.012,8);
    for(const z of [z0,z1]){b.rod(M.podcastPlastic,[1.34,0.06,z],[1.34,2.22,z],0.014,8);block('podcast_screen_stuetze_'+z,1.34,z,0.05,0.05,2.2);}
    for(let i=0;i<15;i++){const z=z0+i*(z1-z0)/14,u=z-mid;b.box(M.paper,0.02,0.027,0.02,1.02+0.32*Math.pow(Math.abs(u)/((z1-z0)/2),5),2.2,z);}
    C.addBox(0.98,z0,1.34,z1,0,2.25,{tag:'stellwand',id:'podcast_greenscreen'});
    anchor('podcast_greenscreen','equipment','Greenscreen mit Bodentuch',1.02,0,mid);
    const cloth=new THREE.PlaneGeometry(1.7,z1-z0-0.13,38,38);cloth.rotateX(-Math.PI/2);
    const cp=cloth.attributes.position;
    for(let i=0;i<cp.count;i++){
      const x=cp.getX(i),z=cp.getZ(i);
      cp.setXYZ(i,x+1.94,0.018+0.018*Math.pow(Math.sin(x*17+z*5),2)+0.025*Math.pow(Math.sin(z*13-x*8),8),z+mid);
    }
    cloth.computeVertexNormals();b.add(M.podcastGreenFloor,cloth);
  }
  function buildShelf(){
    const x=3.9,z=N+0.29;
    b.push(x,0,z);addCubeShelf(b,M);b.pop();block('podcast_regal',x,z,0.78,0.39,1.48);
    anchor('podcast_regal','cabinet','Weißes Regal mit acht Fächern',x,0,z);
    const pack=(label,px,py,pz,w,h,d,ry=0)=>{
      b.push(px,py,pz,ry);b.box(M.paper,w,h,d,0,h/2,0);
      b.add(M['podcastBox_'+label],new THREE.PlaneGeometry(w-0.008,h-0.008),matrixFrom(0,h/2,d/2+0.001));b.pop();
    };
    pack('PSA1+',x-0.08,1.48,z,0.58,0.1,0.2);pack('PSA1+',x-0.08,1.58,z,0.58,0.1,0.2);
    pack('PODMIC',x+0.25,1.48,z,0.22,0.18,0.21);
    pack('PODMIC',x-0.2,1.68,z,0.22,0.16,0.2);
    pack('NTH-100',x+0.055,1.68,z,0.28,0.18,0.2);pack('NTH-100',x+0.055,1.86,z,0.28,0.18,0.2);
    pack('PODMIC',x+0.03,2.04,z,0.21,0.14,0.18);
    // Sichtbare Taschen, Kamera, Kopfhörer, Filmklappe, Zubehör und kleiner Karton.
    b.box(M.podcastSoftbox,0.21,0.13,0.2,x-0.19,1.19,z,0,0,0.3);
    b.push(x+0.19,1.11,z);addHeadphones(b,M);b.pop();
    b.box(M.podcastPlastic,0.14,0.09,0.065,x+0.15,1.18,z+0.1);
    b.cylinder(M.chrome,0.036,0.036,0.025,x+0.15,1.18,z+0.145,12,Math.PI/2);
    b.cylinder(M.podcastScreen,0.026,0.026,0.028,x+0.15,1.18,z+0.16,12,Math.PI/2);
    b.box(M.podcastPlastic,0.28,0.015,0.19,x-0.18,0.76,z+0.025);
    b.add(M.podcastClapper,new THREE.PlaneGeometry(0.27,0.18),matrixFrom(x-0.18,0.769,z+0.025,-Math.PI/2));
    for(let i=0;i<7;i++)b.box(i%2?M.paper:M.black,0.038,0.012,0.03,x-0.3+i*0.038,0.78,z-0.06);
    pack('XLR-3',x+0.18,0.755,z,0.27,0.035,0.18);
    b.box(M.foyerCork,0.13,0.07,0.08,x+0.18,0.795,z+0.1);
    b.box(M.cardboard,0.22,0.12,0.2,x+0.18,0.44,z);
    // Offener Zubehörkarton am Boden rechts vom Regal, wie IMG_4722.
    const cx=4.68,cz=N+0.7,w=0.6,d=0.47,h=0.29;
    b.box(M.cardboard,w,0.014,d,cx,0.008,cz);
    for(const s of [-1,1]){
      b.box(M.cardboard,0.012,h,d,cx+s*w/2,h/2,cz);
      b.box(M.cardboard,w,h,0.012,cx,h/2,cz+s*d/2);
      b.box(M.cardboard,w,0.008,0.22,cx,h-0.04,cz+s*(d/2+0.1),s*0.4);
    }
    b.box(M.podcastSoftbox,0.49,0.1,0.33,cx,0.12,cz);
    b.box(M.black,0.21,0.22,0.15,cx+0.1,0.25,cz-0.06,0,0,0.1);
    b.box(M.red,0.06,0.22,0.153,cx,0.25,cz-0.06,0,0,0.1);
    block('podcast_karton',cx,cz,w,d,h);anchor('podcast_karton','decoration','Offener Zubehörkarton',cx,0,cz);
  }
}

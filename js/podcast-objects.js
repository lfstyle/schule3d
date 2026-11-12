// Wiederverwendbare Studiomöbel und Geräte. Ursprung am Boden / auf der Tischplatte,
// Vorderseite +z. Statische Teile werden vom aufrufenden PartBuilder zusammengeführt.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { matrixFrom } from './geometry.js';

export function addCable(b,M,points,radius=0.003){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  b.add(M.podcastPlastic,new THREE.TubeGeometry(curve,Math.max(12,points.length*5),radius,5,false));
}

export function addStudioDesk(b,M,{width=1.8,depth=0.7,height=0.75}={}){
  b.box(M.tableWhite,width,0.028,depth,0,height-0.014,0);
  b.box(M.steelBlack,width-0.12,0.07,0.06,0,height-0.085,0);
  for(const x of [-width/2+0.12,width/2-0.12]){
    b.box(M.treadSteel,0.055,height-0.07,0.06,x,(height-0.07)/2,0);
    b.box(M.treadSteel,0.075,0.04,depth-0.06,x,0.025,0);
    for(const z of [-depth/2+0.05,depth/2-0.05])b.box(M.black,0.085,0.015,0.065,x,0.008,z);
  }
}

export function addMonitor(b,M,{width=0.66,height=0.39,screen=true}={}){
  b.box(M.podcastPlastic,0.24,0.014,0.18,0,0.007,0.025);
  b.box(M.podcastPlastic,0.045,0.22,0.04,0,0.12,-0.04);
  b.box(M.podcastPlastic,width,height,0.035,0,0.19+height/2,-0.04);
  b.box(M.podcastScreen,width-0.022,height-0.026,0.002,0,0.19+height/2,-0.021);
  // Schaltbares Bild 1 mm vor der dunklen Scheibe (js/devices.js).
  if(screen)b.slot('bildschirm',{w:width-0.022,h:height-0.026},matrixFrom(0,0.19+height/2,-0.019));
  b.box(M.panelGrey,0.015,0.003,0.003,0,0.195,-0.019);
}

export function addKeyboard(b,M){
  b.box(M.podcastPlastic,0.43,0.018,0.145,0,0.009,0);
  for(let row=0;row<5;row++)for(let col=0;col<17;col++){
    if(row===4&&col>3&&col<10)continue;
    b.box(M.handle,0.019,0.005,0.019,-0.196+col*0.024,0.02,-0.055+row*0.026);
  }
  b.box(M.handle,0.15,0.005,0.019,-0.028,0.02,0.049);
  b.add(M.podcastPlastic,new THREE.SphereGeometry(0.035,12,8),matrixFrom(0.29,0.017,0,0,0,0,0.74,0.48,1.25));
  addCable(b,M,[[0.29,0.01,-0.04],[0.3,0.01,-0.13],[0.1,0.01,-0.2]]);
}

export function addComputerTower(b,M){
  b.box(M.podcastPlastic,0.19,0.41,0.39,0,0.205,0);
  b.box(M.handle,0.168,0.21,0.004,0,0.13,0.197);
  for(let i=0;i<9;i++)b.box(M.black,0.14,0.004,0.004,0,0.055+i*0.02,0.2);
  b.box(M.black,0.15,0.025,0.005,0,0.35,0.198);
  b.cylinder(M.chrome,0.009,0.009,0.004,0.06,0.3,0.202,10,Math.PI/2);
  b.box(M.paper,0.024,0.035,0.003,0.065,0.265,0.201);
}

export function addStudioTripod(b,M,{height=1.45,spread=0.36,camera=false}={}){
  b.rod(M.podcastPlastic,[0,0.2,0],[0,height,0],0.018,10);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3+Math.PI/6,x=Math.cos(a)*spread,z=Math.sin(a)*spread;
    b.rod(M.podcastPlastic,[0,height*0.45,0],[x,0.025,z],0.012,8);
    b.rod(M.handle,[0,0.2,0],[x*0.64,0.25,z*0.64],0.006,6);
    b.cylinder(M.black,0.018,0.018,0.035,x,0.018,z,8);
  }
  for(const y of [height*0.45,height*0.72,height-0.12])b.cylinder(M.handle,0.025,0.025,0.035,0,y,0,10);
  b.box(M.red,0.026,0.04,0.01,0,height*0.72,0.026);
  b.box(M.podcastPlastic,0.065,0.025,0.06,0,height,0);
  if(camera){
    b.box(M.podcastPlastic,0.06,0.055,0.055,0,height+0.04,0);
    b.cylinder(M.podcastScreen,0.019,0.019,0.015,0,height+0.04,0.03,14,Math.PI/2);
  }
}

export function addSoftbox(b,M){
  addStudioTripod(b,M,{height:1.85,spread:0.34});
  const w=0.67,h=0.5,y=1.95;
  // Vier Stoffseiten laufen von der rechteckigen Leuchtfläche zum Lampenkopf.
  const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
  for(let i=0;i<4;i++){
    const a=corners[i],c=corners[(i+1)%4];
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([a[0],a[1]+y,0.16,c[0],c[1]+y,0.16,0,y,-0.16],3));
    g.computeVertexNormals();b.add(M.podcastSoftbox,g);
    b.rod(M.podcastYellow,[a[0],a[1]+y,0.16],[c[0],c[1]+y,0.16],0.004,6);
    b.rod(M.podcastYellow,[a[0],a[1]+y,0.16],[0,y,-0.16],0.0025,6);
  }
  b.add(M.podcastDiffuser,new THREE.PlaneGeometry(w-0.025,h-0.025),matrixFrom(0,y,0.164));
  b.box(M.podcastPlastic,0.09,0.12,0.12,0,y,-0.18);
  addCable(b,M,[[0,y,-0.2],[0.04,1.2,-0.15],[0.11,0.08,0],[0.4,0.015,0.25]]);
}

export function addHeadphones(b,M){
  // Flach auf dem Tisch liegender Bügel und gepolsterte Ohrmuscheln.
  b.add(M.podcastPlastic,new THREE.TorusGeometry(0.092,0.011,6,20,Math.PI),matrixFrom(0,0.031,0,Math.PI/2));
  for(const s of [-1,1]){
    b.add(M.podcastPlastic,new RoundedBoxGeometry(0.044,0.06,0.071,2,0.016),matrixFrom(s*0.089,0.035,0.032,0,0,s*0.12));
    b.add(M.black,new RoundedBoxGeometry(0.015,0.05,0.061,2,0.007),matrixFrom(s*0.067,0.036,0.032));
  }
}

export function addMicrophoneArm(b,M,{reach=0.5,angle=0}={}){
  b.push(0,0,0,angle);
  b.cylinder(M.podcastPlastic,0.038,0.047,0.035,0,0.018,0,14);
  const a=[0,0.08,0],c=[0,0.47,-0.15],d=[0,0.36,reach];
  b.bar(M.podcastPlastic,a,c,0.043,0.048);b.bar(M.podcastPlastic,c,d,0.044,0.048);
  for(const p of [a,c,d])b.cylinder(M.handle,0.034,0.034,0.055,...p,14,0,0,Math.PI/2);
  b.rod(M.chrome,d,[0,0.25,reach],0.012,10);
  for(const s of [-1,1])b.bar(M.podcastPlastic,[s*0.052,0.27,reach],[s*0.052,0.18,reach+0.03],0.012,0.014);
  b.cylinder(M.podcastGrille,0.047,0.047,0.15,0,0.18,reach+0.045,20,Math.PI/2);
  for(const z of [reach-0.015,reach+0.04,reach+0.09])b.cylinder(M.podcastPlastic,0.05,0.05,0.013,0,0.18,z,18,Math.PI/2);
  addCable(b,M,[[0.02,0.18,reach-0.05],[0.04,0.35,reach],[0.035,0.5,-0.15],[0.03,0.1,0],[0.1,0.012,0.15]]);
  b.pop();
}

export function addMixer(b,M){
  b.add(M.podcastPlastic,new RoundedBoxGeometry(0.35,0.045,0.27,2,0.012),matrixFrom(0,0.025,0));
  b.box(M.podcastScreen,0.13,0.003,0.065,-0.055,0.05,-0.08);
  for(let i=0;i<6;i++){
    const x=-0.145+i*0.036;
    b.box(M.black,0.008,0.004,0.103,x,0.05,0.04);
    b.box(M.panelGrey,0.021,0.01,0.015,x,0.055,0.025+(i%3)*0.018);
    b.cylinder(M.handle,0.009,0.009,0.014,x,0.055,-0.023,10);
  }
  for(let row=0;row<4;row++)for(let col=0;col<2;col++)b.box(M.panelGrey,0.035,0.004,0.034,0.103+col*0.042,0.05,-0.065+row*0.043);
  for(const x of [-0.14,0.07])b.cylinder(M.handle,0.018,0.018,0.025,x,0.059,-0.095,14);
}

export function addOfficeChair(b,M){
  b.box(M.podcastPlastic,0.46,0.06,0.44,0,0.46,0);
  b.box(M.podcastPlastic,0.44,0.57,0.045,0,0.76,-0.21,-0.08);
  for(let y=0.54;y<1.03;y+=0.045)b.box(M.black,0.4,0.007,0.004,0,y,-0.18);
  b.rod(M.chrome,[0,0.12,0],[0,0.43,0],0.026,12);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5,x=Math.cos(a)*0.29,z=Math.sin(a)*0.29;
    b.bar(M.podcastPlastic,[0,0.13,0],[x,0.07,z],0.035,0.025);
    b.cylinder(M.black,0.032,0.032,0.045,x,0.04,z,10,Math.PI/2);
  }
}

export function addCubeShelf(b,M,{width=0.78,height=1.48,depth=0.39}={}){
  const t=0.035;
  for(const x of [-width/2+t/2,0,width/2-t/2])b.box(M.tableWhite,t,height,depth,x,height/2,0);
  for(let row=0;row<=4;row++)b.box(M.tableWhite,width,t,depth,0,t/2+row*(height-t)/4,0);
}

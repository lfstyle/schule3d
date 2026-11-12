// Werkstatt- und Robotikbauteile nach den Future-Lab-Fotos.
// Ursprung auf Standfläche, Vorderseite +z. Alle Teile werden pro Material vereinigt.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { matrixFrom } from './geometry.js';
import { addCable, addMonitor, addKeyboard, addComputerTower } from './podcast-objects.js';

export function addLabTable(b,M,{width=1.6,depth=0.75,height=0.75}={}){
  b.box(M.tableWhite,width,0.027,depth,0,height-0.0135,0);
  for(const z of [-depth/2+0.07,depth/2-0.07])b.box(M.labSteel,width-0.1,0.065,0.035,0,height-0.075,z);
  for(const x of [-width/2+0.08,width/2-0.08])for(const z of [-depth/2+0.08,depth/2-0.08]){
    b.cylinder(M.labSteel,0.023,0.023,height-0.035,x,(height-0.035)/2,z,8);
    b.cylinder(M.black,0.035,0.035,0.023,x,0.012,z,10);
  }
}

export function addLabChair(b,M,{material=M.labGreen}={}){
  b.add(material,new RoundedBoxGeometry(0.44,0.038,0.43,2,0.015),matrixFrom(0,0.46,0));
  const s=new THREE.Shape();s.moveTo(-0.19,0.53);s.quadraticCurveTo(-0.24,0.73,-0.22,0.91);
  s.quadraticCurveTo(0,0.97,0.22,0.91);s.quadraticCurveTo(0.24,0.73,0.19,0.53);s.closePath();
  const hole=new THREE.Path();hole.absellipse(0,0.84,0.048,0.037,0,Math.PI*2,true);s.holes.push(hole);
  b.add(material,new THREE.ExtrudeGeometry(s,{depth:0.025,bevelEnabled:false,curveSegments:10}),matrixFrom(0,0,-0.22,-0.04));
  b.rod(M.chrome,[0,0.1,0],[0,0.44,0],0.023,10);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5,x=Math.cos(a)*0.29,z=Math.sin(a)*0.29;
    b.bar(M.aluminium,[0,0.12,0],[x,0.065,z],0.035,0.02);
    b.cylinder(M.labRubber,0.031,0.031,0.043,x,0.035,z,8,Math.PI/2);
  }
}

export function addLabPC(b,M,{x=0,y=0.75,z=0,under=true}={}){
  b.push(x,y,z);addMonitor(b,M,{width:0.53,height:0.31});
  b.push(0,0.002,0.27);addKeyboard(b,M);b.pop();
  // Kabel verlassen Monitor und Tower hinten und laufen hinter der Tischkante.
  addCable(b,M,[[0,0.3,-0.07],[0.12,0.05,-0.19],[0.16,0.02,-0.35],[0.16,-0.3,-0.38]]);b.pop();
  if(under){b.push(x+0.22,y-0.54,z+0.02);addComputerTower(b,M);b.pop();}
}

export function addRobotArm(b,M,{yellow=true}={}){
  b.add(M.switchWhite,new RoundedBoxGeometry(0.2,0.095,0.2,2,0.025),matrixFrom(0,0.048,0));
  b.cylinder(M.labRubber,0.058,0.066,0.08,0,0.13,0,14);
  const a=[0,0.16,0],c=[0,0.36,-0.07],d=[0,0.23,0.17];
  b.bar(M.switchWhite,a,c,0.047,0.055);b.bar(M.switchWhite,c,d,0.045,0.05);
  for(const p of [a,c,d])b.cylinder(M.labRubber,0.038,0.038,0.059,...p,12,0,0,Math.PI/2);
  b.rod(M.aluminium,d,[0,0.1,0.2],0.016,10);
  b.box(M.black,0.055,0.033,0.04,0,0.084,0.2);
  for(const x of [-0.025,0.025])b.bar(M.black,[x,0.084,0.2],[x*1.4,0.045,0.23],0.009,0.012);
  const points=[[0.04,0.14,0],[0.04,0.4,-0.08],[0.04,0.29,0.13],[0.04,0.14,0.2]];
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  b.add(yellow?M.labSpoolYellow:M.black,new THREE.TubeGeometry(curve,18,0.008,6,false));
}

export function addRobotStation(b,M){
  b.box(M.labPlate,1.0,0.018,0.7,0,0.009,0);
  for(const x of [-0.09,0.09])b.box(M.aluminium,0.03,0.045,0.67,x,0.045,0);
  b.box(M.labRubber,0.17,0.045,0.65,0,0.055,0);
  for(const z of [-0.31,0.31])b.cylinder(M.labRubber,0.025,0.025,0.18,0,0.05,z,10,0,0,Math.PI/2);
  for(const x of [-0.31,0.31]){b.push(x,0.02,-0.1,x<0?-0.45:0.45);addRobotArm(b,M);b.pop();}
  for(const x of [-0.42,0.42])b.box(M.black,0.04,0.045,0.05,x,0.01,0.35);
}

export function addSpool(b,M,{radius=0.095,material=M.labSpoolYellow}={}){
  b.cylinder(material,radius*0.83,radius*0.83,0.055,0,0,0,20,Math.PI/2);
  for(const z of [-0.035,0.035]){
    b.cylinder(M.panelGrey,radius,radius,0.009,0,0,z,22,Math.PI/2);
    b.cylinder(M.labRubber,radius*0.2,radius*0.2,0.011,0,0,z*1.02,14,Math.PI/2);
  }
}

export function addPrinter3D(b,M,{large=false,open=false}={}){
  const w=large?0.65:0.48,h=large?0.7:0.55,d=large?0.53:0.47;
  b.box(M.podcastPlastic,w,0.09,d,0,0.045,0);
  b.box(M.podcastPlastic,w,0.055,d,0,h-0.0275,0);
  for(const x of [-w/2+0.018,w/2-0.018])for(const z of [-d/2+0.018,d/2-0.018])b.box(M.podcastPlastic,0.035,h,0.035,x,h/2,z);
  b.box(M.podcastPlastic,w-0.035,h-0.12,0.02,0,h/2,-d/2);
  if(!open)for(const x of [-w/2,w/2])b.box(M.labCabinet,0.015,h-0.1,d,x,h/2,0);
  b.box(M.aluminium,w-0.08,0.018,d-0.09,0,0.16,0);
  for(const x of [-w/2+0.06,w/2-0.06])b.rod(M.chrome,[x,0.1,-d/2+0.07],[x,h-0.07,-d/2+0.07],0.008,8);
  b.rod(M.steel,[-w/2+0.04,h-0.15,0],[w/2-0.04,h-0.15,0],0.01,8);
  b.box(M.black,0.08,0.1,0.065,0.03,h-0.15,0);
  b.box(M.labSpoolCyan,0.065,0.08,0.065,-0.04,0.2,0);
  if(!open)b.add(M.labTint,new THREE.PlaneGeometry(w-0.06,h-0.14),matrixFrom(0,h/2,d/2+0.003));
  b.box(M.black,0.13,0.065,0.04,-w/2+0.07,h-0.035,d/2+0.015,-0.25);
  b.box(M.labScreen,0.105,0.045,0.003,-w/2+0.07,h-0.035,d/2+0.039);
  b.add(M.labMachineLabel,new THREE.PlaneGeometry(0.13,0.032),matrixFrom(w/2-0.11,h-0.045,d/2+0.022));
  if(!open){
    b.box(M.black,w-0.04,0.03,d-0.1,0,h+0.015,-0.01);
    for(let i=0;i<4;i++){b.push(-w*0.3+i*w*0.2,h+0.12,-0.01,Math.PI/2);addSpool(b,M,{radius:0.095,material:[M.labGreen,M.red,M.paper,M.black][i]});b.pop();}
    b.box(M.labTint,w-0.02,0.22,d-0.08,0,h+0.14,-0.01);
  }
}

export function addCubby(b,M,{width=1.5,height=0.8,depth=0.55,cols=4,rows=2}={}){
  b.box(M.tableWhite,width,height,0.025,0,height/2,-depth/2);
  for(let i=0;i<=cols;i++)b.box(M.tableWhite,0.024,height,depth,-width/2+i*width/cols,height/2,0);
  for(let i=0;i<=rows;i++)b.box(M.tableWhite,width,0.025,depth,0,0.012+i*(height-0.025)/rows,0);
}

export function addCNC(b,M){
  addLabTable(b,M,{width:1.38,depth:0.86,height:0.8});
  b.box(M.pine,1.16,0.065,0.65,0,0.88,0);
  for(const x of [-0.65,0.65])for(const z of [-0.4,0.4])b.box(M.aluminium,0.035,0.98,0.035,x,1.31,z);
  for(const y of [0.83,1.79])for(const z of [-0.4,0.4])b.box(M.aluminium,1.34,0.035,0.035,0,y,z);
  for(const y of [0.83,1.79])for(const x of [-0.65,0.65])b.box(M.aluminium,0.035,0.035,0.83,x,y,0);
  for(const z of [-0.4,0.4])b.add(M.labGlass,new THREE.PlaneGeometry(1.28,0.92),matrixFrom(0,1.31,z));
  for(const x of [-0.65,0.65])b.add(M.labGlass,new THREE.PlaneGeometry(0.78,0.92),matrixFrom(x,1.31,0,0,Math.PI/2));
  b.box(M.aluminium,0.03,0.94,0.035,0,1.31,0.41);
  b.box(M.aluminium,1.1,0.13,0.12,0,1.2,-0.1);
  b.box(M.aluminium,0.15,0.48,0.12,-0.25,1.35,0);
  b.cylinder(M.steel,0.05,0.05,0.25,-0.25,1.22,0.11,14);
  b.cylinder(M.labRubber,0.07,0.05,0.07,-0.25,1.06,0.11,14);
  b.rod(M.black,[-0.58,1.16,0.44],[-0.58,1.4,0.44],0.015,8);
  b.box(M.labSpoolYellow,0.06,0.025,0.06,-0.52,0.89,0.3);b.cylinder(M.red,0.022,0.022,0.035,-0.52,0.92,0.3,10);
  // Absaugung mit dünnem Schlauch, kein schwerer undurchsichtiger Block vor der Fräse.
  const curve=new THREE.CatmullRomCurve3([[-0.25,1.22,0.1],[-0.23,1.65,0.1],[0.2,1.7,0],[0.55,1.6,0],[0.57,0.4,0.25]].map(p=>new THREE.Vector3(...p)));
  b.add(M.labRubber,new THREE.TubeGeometry(curve,30,0.026,8,false));
  b.box(M.labCabinet,0.5,0.28,0.38,0,0.21,0.1);b.box(M.black,0.51,0.07,0.39,0,0.38,0.1);
  b.box(M.labGreen,0.1,0.035,0.015,0,0.39,0.31);
  for(const x of [-0.23,0.23])b.cylinder(M.black,0.055,0.055,0.04,x,0.07,0.15,10,Math.PI/2);
  b.box(M.switchWhite,0.44,0.12,0.3,0,0.48,0.1);
}

export function addLaser(b,M){
  b.add(M.podcastPlastic,new RoundedBoxGeometry(1.08,0.4,0.63,2,0.03),matrixFrom(0,0.2,0));
  b.box(M.labSteel,1.04,0.075,0.58,0,0.4,0);
  b.box(M.labTint,0.78,0.008,0.43,-0.07,0.443,0);
  b.rod(M.chrome,[-0.46,0.35,0.32],[0.43,0.35,0.32],0.009,10);
  b.cylinder(M.chrome,0.025,0.025,0.006,0.46,0.444,-0.2,12);
  b.add(M.labLaserLabel,new THREE.PlaneGeometry(0.16,0.04),matrixFrom(0,0.32,0.321));
  b.box(M.labSpoolYellow,0.04,0.016,0.002,0.46,0.12,0.32);
}

export function addPlotter(b,M){
  for(const x of [-0.54,0.54]){b.box(M.podcastPlastic,0.055,0.75,0.055,x,0.375,0);b.box(M.black,0.08,0.04,0.53,x,0.03,0.03);}
  b.box(M.podcastPlastic,1.22,0.3,0.38,0,0.9,0);
  b.box(M.black,0.96,0.15,0.026,0,0.91,0.203);
  b.rod(M.labSpoolYellow,[-0.48,0.99,0.22],[0.48,0.99,0.22],0.012,10);
  b.box(M.cardboard,0.42,0.003,0.3,-0.07,0.815,0.25);
  b.box(M.labSteel,0.08,0.12,0.06,0.22,0.91,0.24);
  b.box(M.labScreen,0.05,0.04,0.003,0.55,0.96,0.192);
  b.box(M.labRubber,0.97,0.35,0.15,0,0.47,0.1);
}

export function addHeatPress(b,M,{cap=false}={}){
  b.box(M.labSteel,cap?0.28:0.53,0.06,cap?0.32:0.6,0,0.03,0);
  b.box(M.labBlue,cap?0.2:0.46,0.035,cap?0.22:0.48,0,0.085,0.05);
  b.box(M.aluminium,cap?0.22:0.48,0.065,cap?0.24:0.5,0,0.22,0.02);
  b.box(M.labSteel,0.12,0.28,0.09,0,0.2,-0.21);
  for(const x of [-0.15,0.15])b.bar(M.steel,[x,0.22,-0.17],[x,0.48,0.04],0.025,0.03);
  b.rod(M.labBlue,[-0.15,0.48,0.04],[0.15,0.48,0.04],0.02,10);
  b.box(M.labScreen,0.09,0.06,0.01,0,0.32,-0.15);
}

export function addEmbroidery(b,M){
  addLabTable(b,M,{width:0.76,depth:0.65,height:0.78});
  b.box(M.switchWhite,0.36,0.14,0.42,0,0.88,-0.05);
  b.box(M.switchWhite,0.35,0.43,0.22,0,1.2,-0.13);
  b.box(M.switchWhite,0.48,0.12,0.33,0,1.42,-0.08);
  for(let i=0;i<10;i++){
    const x=-0.2+i*0.044;
    b.cylinder([M.paper,M.labGreen,M.labBlue,M.labSpoolYellow][i%4],0.018,0.025,0.075,x,1.52,-0.05,10);
    b.rod(M.chrome,[x,1.4,0.09],[x,1.04,0.09],0.004,6);
    b.rod(M.paper,[x,1.55,-0.05],[x,1.85,-0.1],0.0013,4);
  }
  for(const x of [-0.22,0.22])b.rod(M.steel,[x,1.45,-0.2],[x,1.87,-0.2],0.008,8);
  b.box(M.steel,0.5,0.035,0.04,0,1.86,-0.2);
  b.box(M.paper,0.4,0.012,0.25,0,0.99,0.12);
  b.box(M.labCabinet,0.17,0.32,0.035,0.34,1.28,0.02);b.box(M.labScreen,0.145,0.25,0.004,0.34,1.29,0.041);
  b.add(M.labEmbroideryLabel,new THREE.PlaneGeometry(0.16,0.035),matrixFrom(0,1.32,-0.008));
  b.cylinder(M.paper,0.11,0.11,0.4,0,0.25,0,16,0,0,Math.PI/2);
}

export function addRover(b,M){
  b.box(M.labSteel,0.26,0.075,0.3,0,0.105,0);
  for(const x of [-0.17,0.17])for(const z of [-0.11,0.11]){
    b.cylinder(M.labRubber,0.067,0.067,0.065,x,0.07,z,12,0,0,Math.PI/2);
    b.cylinder(M.labSteel,0.03,0.03,0.07,x,0.07,z,12,0,0,Math.PI/2);
  }
  b.bar(M.black,[0,0.13,0],[0,0.34,0.07],0.05,0.035);
  b.bar(M.black,[0,0.34,0.07],[0,0.18,0.23],0.04,0.03);
  for(const s of [-1,1])b.bar(M.black,[0,0.18,0.23],[s*0.055,0.16,0.3],0.016,0.025);
  b.rod(M.red,[0.035,0.15,0],[0.035,0.3,0.09],0.005,6);
}

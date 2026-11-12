// Future Lab = frühere Räume 125/126. Grundlage: 61 lokale Fotos/Pläne.
// Alle Meterwerte sind angenähert. Gemeinsame Eingangstüren bleiben in flur.js / flur1.js.
import * as THREE from 'three';
import { PartBuilder, matrixFrom } from '../geometry.js';
import { addWall, addWindow, addRadiator, addVerticalRadiator, addSwitchPlate, createWallClock, addUtilityCabinet } from '../objects.js';
import { addCable, addHeadphones } from '../podcast-objects.js';
import { addLabTable, addLabChair, addLabPC, addRobotStation, addSpool, addPrinter3D,
  addCubby, addCNC, addLaser, addPlotter, addHeatPress, addEmbroidery, addRover } from '../futurelab-objects.js';

export const FUTURE_LAB={
  east:0.1,divider:-2.65,workshopWest:-2.43,workshopNorth:-16.3,
  north:-17.1,south:-11.42,entryWest:-5.2,entrySouth:-8.07,height:3.3,lowerY:-0.36,
  westSouth:-13.1,westNorth:-13.65,
  foyerDoor:{x:-3.85,z:-7.85},hallDoor:{x:-12.32,z:-11.22},
  passage:{south:-9.3,north:-11.4,height:2.82},
  edge:[[-13.427,-14.8],[-12.25,-14.8],[-6.1,-13.9],[-4.85,-13.9],[-2.65,-13.65]],
};

export function buildFutureLab(ctx){
  const {scene,collision:C,materials:M,registerObject,interactions,lighting,audio,map}=ctx;
  const F=FUTURE_LAB,H=F.height,Y=F.lowerY;
  const root=new THREE.Group();root.name='future_lab';scene.add(root);
  const b=new PartBuilder(),perim=new PartBuilder(),walls=new PartBuilder(),fixtures=new PartBuilder(),lights=[];
  const wm={...M,baseboard:M.labSkirting};
  const anchor=(id,type,name,x,y,z)=>{const o=new THREE.Object3D();o.position.set(x,y,z);root.add(o);registerObject(id,type,name,o);return o;};
  const solid=(id,x,y,z,w,d,h,ry=0,tag='moebel')=>{
    C.add({x,z,w,d,rot:ry,bottom:y,top:y+h,tag,id});
    const wx=Math.abs(Math.cos(ry))*w+Math.abs(Math.sin(ry))*d,dz=Math.abs(Math.sin(ry))*w+Math.abs(Math.cos(ry))*d;
    map.furniture.push([x-wx/2,z-dz/2,x+wx/2,z+dz/2]);
  };
  const plane=(mat,w,h,x,y,z,ry=0,rx=0,target=b)=>target.add(mat,new THREE.PlaneGeometry(w,h),matrixFrom(x,y,z,rx,ry));
  const wall=(a,c,openings=[],y0=Y,height=H-y0,collide=true,thickness=0.22)=>{
    const r=addWall(walls,wm,{start:a,end:c,openings,height,y0,thickness,material:M.labWall});
    if(collide){r.colliders.forEach(v=>C.add({...v,tag:'wand'}));map.walls.push(...r.segments);}return r;
  };
  // Polygonflächen behalten den leicht schrägen Grundriss und die versetzte Podestkante.
  function polygon(poly,y,mat,down=false,tile=0.6){
    const points=poly.map(p=>new THREE.Vector2(...p)),tris=THREE.ShapeUtils.triangulateShape(points,[]),p=[],uv=[];
    for(const tri of tris){
      let [a,c,d]=tri.map(i=>poly[i]);
      const cross=(c[1]-a[1])*(d[0]-a[0])-(c[0]-a[0])*(d[1]-a[1]);
      if((cross>0)===down)[c,d]=[d,c];
      for(const q of [a,c,d]){p.push(q[0],y,q[1]);uv.push(q[0]/tile,q[1]/tile);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;root.add(mesh);return mesh;
  }
  function floor(poly,y){
    polygon(poly,y,M.labFloor);
    // Dünne Streifen folgen auch schrägen Wänden, ohne imaginären Boden außerhalb des Raums.
    const lo=Math.min(...poly.map(p=>p[0])),hi=Math.max(...poly.map(p=>p[0])),n=Math.ceil((hi-lo)/0.16);
    for(let i=0;i<n;i++){
      const x0=lo+(hi-lo)*i/n,x1=lo+(hi-lo)*(i+1)/n,x=(x0+x1)/2,zs=[];
      for(let k=0;k<poly.length;k++){
        const a=poly[k],c=poly[(k+1)%poly.length];
        if((a[0]<=x&&c[0]>x)||(c[0]<=x&&a[0]>x))zs.push(a[1]+(c[1]-a[1])*(x-a[0])/(c[0]-a[0]));
      }
      zs.sort((a,c)=>a-c);for(let k=0;k<zs.length;k+=2)C.addBox(x0,zs[k],x1,zs[k+1],y-0.16,y,{tag:'boden',surface:'tile'});
    }
  }
  const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  const mainPoly=[[F.westSouth,F.south],[F.divider,F.south],[F.divider,F.north],[F.westNorth,F.north]];
  const entryPoly=rect(F.entryWest,F.south,F.divider,F.entrySouth);
  const workPoly=rect(F.workshopWest,F.workshopNorth,F.east,F.entrySouth);
  floor(mainPoly,Y);
  const upperPoly=[[F.westSouth,F.south],[F.divider,F.south],...F.edge.slice().reverse()];
  floor(upperPoly,0);floor(entryPoly,0);floor(workPoly,0);
  floor(rect(F.divider,F.passage.north,F.workshopWest,F.passage.south),0);
  for(const door of [F.foyerDoor,F.hallDoor]){
    floor(rect(door.x-0.55,door.z-0.22,door.x+0.55,door.z),0);
    perim.box(M.aluminium,1.04,0.006,0.045,door.x,0.003,door.z-0.08);
  }
  for(const poly of [mainPoly,entryPoly,workPoly]){
    polygon(poly,H,M.labCeiling,true);
    polygon(poly,H+0.17,M.foyerRoof).castShadow=true;
    const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]);
    C.addBox(Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs),H,H+0.16,{tag:'decke'});
  }
  polygon(rect(F.divider,F.passage.north,F.workshopWest,F.passage.south),H,M.labCeiling,true);

  // Südliche Wand hinter den WCs. Der kurze westliche Anschluss ist bereits Flur-1-Wand.
  wall([F.entryWest,F.south],[-11.58,F.south],[],0,H);
  wall([F.entryWest,F.entrySouth],[F.entryWest,F.south],[],0,H);
  // Weiße innere Verkleidung am bestehenden Flurportal, ohne zweites Türblatt.
  for(const [a,c] of [[F.westSouth,-12.87],[-11.77,-11.58]])if(c>a)perim.box(M.labWall,c-a,H,0.018,(a+c)/2,H/2,F.south-0.008);
  perim.box(M.labWall,1.1,0.25,0.018,F.hallDoor.x,H-0.125,F.south-0.008);

  // Stirnwand mit vier Oberlichtern und schmalem hohem Glasfeld.
  const westOpen=[0.65,2.0,3.35,4.7].map(u=>({u:u-0.25,w:0.5,y:2.65-Y,h:0.5}));
  westOpen.push({u:2.0-0.28,w:0.56,y:0.08-Y,h:2.15});
  const wr=wall([F.westSouth,F.south],[F.westNorth,F.north],westOpen);
  for(const o of westOpen){
    const u=o.u+o.w/2,x=F.westSouth+wr.dir[0]*u,z=F.south+wr.dir[1]*u;
    perim.push(x,Y+o.y+o.h/2,z,wr.rot);addWindow(perim,M,{w:o.w,h:o.h,frame:M.windowFrameGrey,glass:M.labFrost,inset:0.08,sill:false});perim.pop();
  }
  // Lange Fensterfront: drei große Gruppen und separate kleine Oberlichter.
  const nOpen=[];
  for(const x of [-9.5,-6.8,-4.1])nOpen.push({u:x-F.westNorth-1.16,w:2.32,y:0.04,h:2.4});
  for(let x=-12.8;x<-2.9;x+=1.4)nOpen.push({u:x-F.westNorth-0.25,w:0.5,y:2.68-Y,h:0.47});
  wall([F.westNorth,F.north],[F.divider,F.north],nOpen);
  for(const o of nOpen){
    const x=F.westNorth+o.u+o.w/2,cy=Y+o.y+o.h/2;
    perim.push(x,cy,F.north);addWindow(perim,M,{w:o.w,h:o.h,frame:M.windowFrameGrey,glass:o.h>1?M.labGlass:M.labFrost,inset:0.09,sill:false,rows:o.h>1?[{f:0.18,cols:3},{f:0.82,cols:3}]:[{f:1,cols:1}]});perim.pop();
    if(o.h>1){
      plane(M.labFrost,o.w-0.1,1.17,x,Y+0.65,F.north-0.08,0,0,perim);
      for(let j=0;j<7;j++)perim.box(M.labFrost,o.w-0.1,0.012,0.002,x,Y+1.25+j*0.035,F.north-0.078);
      for(const sx of [-0.71,0,0.71])perim.rod(M.chrome,[x+sx,Y+0.94,F.north+0.02],[x+sx,Y+1.08,F.north+0.02],0.009,8);
    }
  }
  perim.box(M.duct,7.9,0.035,0.045,-6.8,2.24,F.north+0.1);
  for(let i=0;i<15;i++)perim.box(M.podcastDiffuser,0.09,2.42,0.012,-7.57+i*0.067,0.96,F.north+0.14,0,0.22);
  // Trennwand: ein breiter Durchbruch, Sturz und massive Restflächen, ohne Glasscheibe.
  const po=F.passage;
  // Öffnungsunterkante 3 mm unter der Bodenplatte des Durchgangs: sonst gleiche Ebene (Flackern).
  wall([F.divider,F.north],[F.divider,F.entrySouth],[{u:po.north-F.north,w:po.south-po.north,y:-Y-0.003,h:po.height+0.003}],Y,H-Y,false);
  // Diese Öffnung liegt über dem tieferen Boden: ihre Kollision separat auf Niveau 0.
  C.addBox(F.divider,F.north,F.workshopWest,po.north,Y,H,{tag:'wand'});
  C.addBox(F.divider,po.south,F.workshopWest,F.entrySouth,0,H,{tag:'wand'});
  C.addBox(F.divider,po.north,F.workshopWest,po.south,po.height,H,{tag:'wand'});
  map.walls.push([F.divider,F.north,F.divider,po.north],[F.divider,po.south,F.divider,F.entrySouth]);
  anchor('lab_durchbruch','architecture','Offener Durchbruch zwischen 125 und 126',F.divider,0,(po.north+po.south)/2);
  // 3 mm dünner: Außenfläche sonst bündig mit der Innenfläche der Podcast-Westwand (Flackern in Raum 127).
  wall([F.east,F.workshopNorth],[F.east,F.entrySouth],[],0,H,true,0.217);
  wall([F.workshopWest,F.workshopNorth],[F.east,F.workshopNorth],[{u:0.18,w:2.16,y:0.7,h:2.22}],0,H);
  perim.push(-1.165,1.81,F.workshopNorth);addWindow(perim,M,{w:2.16,h:2.22,inset:0.08,frame:M.windowFrameGrey,glass:M.labGlass,rows:[{f:0.73,cols:[0.27,0.46,0.27]},{f:0.27,cols:[0.27,0.46,0.27]}]});perim.pop();
  perim.box(M.foyerWood,2.2,0.035,0.2,-1.165,0.68,F.workshopNorth+0.02);
  perim.push(-1.165,0,F.workshopNorth+0.06);addRadiator(perim,M,{width:2.05,height:0.48,y0:0.12});perim.pop();
  // Rückseite der Foyer-Holzfront/Oberlichter. Gemeinsames Glas wird nur im Foyer gebaut.
  for(const x of [-4.9,-2.95,-1.65,-0.3])for(const y of [2.25,3.18])perim.box(M.foyerFrame,0.45,0.035,0.04,x,y,F.entrySouth-0.012);
  for(const x of [-4.4,-3.3])perim.box(M.foyerFrame,0.07,2.25,0.04,x,1.125,F.entrySouth-0.01);

  buildStepsAndRail();buildRoom125();buildRoom126();buildCeilingAndServices();
  root.add(walls.build({name:'futurelab_waende',castShadow:false}),perim.build({name:'futurelab_wanddetails'}),b.build({name:'futurelab_ausstattung'}),fixtures.build({name:'futurelab_leuchten',castShadow:false}));
  for(const poly of [mainPoly,entryPoly,workPoly])map.areas.push({poly,fill:'rgba(174,190,171,0.17)'});
  map.labels.push({text:'125 · Future Lab',x:-8.2,z:-14.7},{text:'126 · Werkstatt',x:-1.1,z:-12.6});
  const contains=(poly,x,z)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if(((poly[i][1]>z)!==(poly[j][1]>z))&&(x<(poly[j][0]-poly[i][0])*(z-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0]))c=!c;return c;};
  return {id:'future_lab',name:'Future Lab 125/126',root,bounds:{minX:F.westNorth-0.25,maxX:F.east+0.22,minZ:F.north-0.22,maxZ:-7.85,maxY:H+0.2},
    areaName(p){if(p.y<Y-0.3||p.y>H+0.1)return null;if(contains(workPoly,p.x,p.z))return 'Future Lab · Werkstatt 126';if(contains(mainPoly,p.x,p.z)||contains(entryPoly,p.x,p.z))return 'Future Lab · 125';return null;}};

  function buildStepsAndRail(){
    for(let i=0;i<F.edge.length-1;i++){
      const a=F.edge[i],c=F.edge[i+1],len=Math.hypot(c[0]-a[0],c[1]-a[1]),ry=-Math.atan2(c[1]-a[1],c[0]-a[0]);
      perim.push(a[0],0,a[1],ry);perim.box(M.labFloor,len,-Y,0.035,len/2,Y/2,0);perim.box(M.aluminium,len,0.014,0.035,len/2,0.004,0);perim.pop();
      if(i===0||i===2){
        const x=(a[0]+c[0])/2,z=a[1]-0.15;
        perim.box(M.labFloor,len,0.18,0.3,x,Y+0.09,z);
        perim.box(M.aluminium,len,0.014,0.035,x,-0.174,z-0.15);
        C.addBox(a[0],a[1]-0.3,c[0],a[1],Y,-0.18,{tag:'treppe',surface:'tile',id:'lab_stufe_'+i});
        anchor('lab_treppe_'+i,'stairs','Zwei Stufen zum Fensterbereich',x,0,z);
      }else{
        const posts=Math.ceil(len/1.3);
        for(let j=0;j<=posts;j++){
          const t=j/posts,x=a[0]+(c[0]-a[0])*t,z=a[1]+(c[1]-a[1])*t;
          perim.box(M.labSteel,0.065,1.04,0.055,x,0.51,z);perim.box(M.labSteel,0.13,0.018,0.12,x,0.009,z);
        }
        perim.rod(M.chrome,[a[0],1.03,a[1]],[c[0],1.03,c[1]],0.027,12);
        for(let j=0;j<5;j++)perim.rod(M.labSteel,[a[0],0.18+j*0.15,a[1]],[c[0],0.18+j*0.15,c[1]],0.007,6);
        C.add({x:(a[0]+c[0])/2,z:(a[1]+c[1])/2,w:len,d:0.065,rot:ry,bottom:Y,top:1.06,tag:'gelaender'});
        map.walls.push([...a,...c]);
      }
    }
  }
  function table(id,x,y,z,width,depth,ry=0){
    b.push(x,y,z,ry);addLabTable(b,M,{width,depth});b.pop();
    solid(id,x,y+0.69,z,width,depth,0.06,ry,'tisch');
    const m=matrixFrom(x,y,z,0,ry);
    for(const u of [-width/2+0.08,width/2-0.08])for(const v of [-depth/2+0.08,depth/2-0.08]){
      const p=new THREE.Vector3(u,0,v).applyMatrix4(m);C.add({x:p.x,z:p.z,w:0.055,d:0.055,bottom:y,top:y+0.7,tag:'tischbein'});
    }
    anchor(id,'table','Future-Lab-Arbeitstisch',x,y,z);
  }
  function chair(id,x,y,z,ry=0,material=M.labGreen){
    b.push(x,y,z,ry);addLabChair(b,M,{material});b.pop();solid(id,x,y,z,0.48,0.48,0.96,ry,'stuhl');anchor(id,'chair','Drehstuhl',x,y,z);
  }
  function equipment(id,name,x,y,z,ry,fn,w,d,h){
    b.push(x,y,z,ry);fn();b.pop();anchor(id,'equipment',name,x,y,z);if(w)solid(id,x,y,z,w,d,h,ry);
  }
  function buildRoom125(){
    // Drei Doppelplätze entlang der inneren Wand, Blickrichtung zur Stirnwand.
    for(const [i,x] of [-6.9,-8.8,-10.7].entries()){
      table('lab_pc_tisch_'+i,x,0,-12.17,1.45,0.75,-Math.PI/2);
      b.push(x,0,-12.17,-Math.PI/2);for(const u of [-0.36,0.36])addLabPC(b,M,{x:u,y:0.75,z:-0.12});b.pop();
      for(const [j,z] of [-11.81,-12.53].entries())chair('lab_pc_stuhl_'+i+'_'+j,x-0.68,0,z,Math.PI/2);
    }
    table('lab_lehrertisch',-5.75,0,-12.05,1.3,0.75,Math.PI/2);
    b.push(-5.75,0,-12.05,Math.PI/2);addLabPC(b,M,{y:0.75,z:-0.12});b.pop();chair('lab_lehrerstuhl',-5.25,0,-12.05,-Math.PI/2);
    // Robotik entlang der großen Fenster: drei Doppelplätze und ein weiterer am Wandende.
    for(const [i,x] of [-9.5,-7.1,-4.7].entries())robotDesk(i,x,Y,-16.65,0);
    robotDesk(3,-3.1,Y,-15.25,-Math.PI/2);
    function robotDesk(i,x,y,z,ry){
      table('lab_robotiktisch_'+i,x,y,z,2.2,0.76,ry);b.push(x,y+0.75,z,ry);addRobotStation(b,M);
      for(const u of [-0.82,0.82]){b.push(u,0,-0.13);addLabPC(b,M,{y:0,under:false});b.pop();}b.pop();
      const transform=matrixFrom(x,y,z,0,ry);
      for(const [j,u] of [-0.8,0.8].entries()){
        // Nutzerkorrektur: überlappendes Eckpaar und Stuhl am Kistentisch entfallen.
        if(i===3||(i===2&&j===1))continue;
        // Übrige Sitze 27 cm näher an die Tischkante rücken; Kollision/Karte folgen mit.
        const p=new THREE.Vector3(u,0,0.55).applyMatrix4(transform);chair('lab_robotikstuhl_'+i+'_'+j,p.x,y,p.z,ry+Math.PI,(i===0&&j===0)?M.labGreen:M.labBlue);
      }
      anchor('lab_robotik_'+i,'equipment','Roboterarme und Förderband',x,y+0.75,z);
    }
    // Drei geschlossene Drucker auf der unteren Ebene; vierter Drucker oben am Geländer.
    table('lab_druckertisch',-11.93,Y,-16.66,2.65,0.76);
    for(const [i,x] of [-12.75,-11.95,-10.95].entries())equipment('lab_3ddrucker_'+i,'3D-Drucker',x,Y+0.75,-16.67,0,()=>addPrinter3D(b,M,{large:i===0}));
    for(const x of [-11.5,-10.48]){
      b.box(M.labSpoolYellow,0.32,0.025,0.2,x,Y+0.77,-16.55);
      for(const sx of [-0.14,0.14])b.box(M.labSpoolYellow,0.025,0.36,0.2,x+sx,Y+0.95,-16.55);
      for(let j=0;j<4;j++){b.push(x-0.09+(j%2)*0.16,Y+0.86+Math.floor(j/2)*0.18,-16.55,Math.PI/2);addSpool(b,M,{radius:0.08,material:[M.red,M.paper,M.labBlue,M.labSpoolPink][j]});b.pop();}
    }
    table('lab_druckertisch_oben',-10.55,0,-14.05,1.7,0.66);
    equipment('lab_3ddrucker_3','Offener 3D-Drucker',-10.35,0.75,-14.05,0,()=>addPrinter3D(b,M,{large:true,open:true}));
    for(const x of [-11.05,-10.45])b.box(M.cardboard,0.47,0.35,0.48,x,0.175,-14.05);
    // Filamentschrank auf der unteren Seite des Geländers.
    equipment('lab_filamentschrank','Filamentschrank',-9.9,Y,-14.72,Math.PI,()=>{
      addCubby(b,M,{width:1.5,height:1.8,depth:0.4,cols:3,rows:5});
      for(let row=0;row<5;row++)for(let col=0;col<2;col++){
        const x=-0.5+col*0.5,y=0.05+row*0.35;b.box(M.cardboard,0.43,0.22,0.32,x,y+0.11,0);
        plane(M.labFilamentLabel,0.17,0.08,x,y+0.14,0.166);
      }
      for(let i=0;i<35;i++)b.box(M.labCabinet,0.47,0.018,0.02,0.5,0.05+i*0.049,0.215);
      b.rod(M.chrome,[0.35,0.95,0.24],[0.65,0.95,0.24],0.009,8);
      for(const x of [-0.17,0.17])b.rod(M.labGreen,[x,1.8,0],[x,2.15,0],0.008,8);
      b.rod(M.labGreen,[-0.17,2.15,0],[0.17,2.15,0],0.008,8);
      for(let i=0;i<5;i++)b.rod(M.red,[-0.12+i*0.06,2.15,0],[-0.12+i*0.06,1.87,0.03],0.005,6);
    },1.5,0.44,1.8);
    table('lab_basteltisch',-8.15,Y,-14.6,1.5,0.72);
    b.push(0,0,0.35);
    for(const x of [-8.55,-8.05,-7.7]){
      b.push(x,Y+0.78,-14.9,0.5);addHeadphones(b,M);b.pop();
      b.box(M.switchWhite,0.17,0.09,0.12,x,Y+0.8,-15.02);b.box(M.black,0.14,0.045,0.01,x,Y+0.81,-14.95);
    }
    b.box(M.pine,0.55,0.018,0.34,-8.55,Y+0.77,-14.82);
    for(let i=0;i<5;i++)b.box([M.labSpoolYellow,M.labBlue,M.red][i%3],0.055,0.035,0.065,-8.7+i*0.08,Y+0.81,-14.85);
    b.pop();
    table('lab_kistentisch',-3.8,Y,-14.1,1.55,0.66);
    for(const x of [-4.2,-3.5]){
      b.box(M.labCabinet,0.5,0.32,0.37,x,Y+0.91,-14.08);b.box(M.labSteel,0.53,0.1,0.4,x,Y+1.08,-14.08);
      b.box(M.red,0.16,0.025,0.015,x,Y+1.04,-13.87);b.box(M.cardboard,0.23,0.19,0.22,x,Y+1.18,-14.07);
    }
    for(let i=0;i<5;i++)equipment('lab_fahrroboter_'+i,'Fahrroboter',-4.4+i*0.31,Y,-14.12,0,()=>addRover(b,M));
    table('lab_demo_tisch',-3.17,0,-12.15,1.45,0.7,-Math.PI/2);
    b.push(-3.17,0.75,-12.15,-Math.PI/2);addRobotStation(b,M);b.pop();
    // Großer Bildschirm hängt an dem erhaltenen Teil der Trennwand.
    b.push(F.divider-0.06,2.15,-15.15,-Math.PI/2);
    b.box(M.black,1.45,0.84,0.065,0,0,0);b.box(M.podcastScreen,1.4,0.79,0.005,0,0,0.036);b.pop();
    b.rod(M.black,[F.divider-0.08,H,-15.15],[F.divider-0.08,2.5,-15.15],0.016,8);
    anchor('lab_bildschirm','equipment','Großer Bildschirm',F.divider-0.1,2.15,-15.15);
    perim.push(-13.48,Y,-15.8,Math.PI/2);addRadiator(perim,M,{width:1.6,height:0.6});perim.pop();
    perim.push(F.divider-0.06,Y,-15.2,-Math.PI/2);addRadiator(perim,M,{width:1.55,height:0.6});perim.pop();
    perim.push(-5.17,0,-9.8,Math.PI/2);addVerticalRadiator(perim,M,{width:0.45,height:1.65});perim.pop();
    solid('lab_heizung_eingang',-5.08,0,-9.8,0.18,0.5,1.65);
  }
  function buildRoom126(){
    // Hochschränke an der alten Foyerfront. Tür 126 bleibt geschlossen.
    equipment('lab_hochschraenke','Graue Hochschränke',-1.1,0,-8.44,Math.PI,()=>addUtilityCabinet(b,M,{width:2.35,height:2.08,depth:0.58,material:M.labCabinet}),2.35,0.58,2.08);
    for(const x of [-1.8,-1.1,-0.4])b.box(M.black,0.45,0.22,0.34,x,2.19,-8.44);
    equipment('lab_stickmaschine','Stickmaschine',-0.52,0,-9.35,-Math.PI/2,()=>addEmbroidery(b,M),0.76,0.65,1.9);
    chair('lab_stickstuhl',-1.18,0,-9.35,Math.PI/2);
    equipment('lab_cnc','CNC-Fräse mit Einhausung',-0.38,0,-10.85,-Math.PI/2,()=>addCNC(b,M),1.38,0.86,1.82);
    // Waschbecken am erhaltenen Wandrest.
    b.push(F.workshopWest+0.03,0,-11.85,Math.PI/2);
    b.box(M.labFloor,0.65,0.85,0.03,0,1.08,-0.01);
    b.add(M.switchWhite,new THREE.SphereGeometry(0.27,20,12),matrixFrom(0,0.8,0.19,0,0,0,1,0.24,0.76));
    b.box(M.switchWhite,0.56,0.04,0.25,0,0.84,0.11);
    b.rod(M.chrome,[0,0.85,0.035],[0,1.02,0.035],0.016,10);b.rod(M.chrome,[0,1.02,0.035],[0,1.02,0.18],0.012,10);
    b.rod(M.chrome,[0,0.78,0.18],[0,0.43,0.18],0.02,10);b.rod(M.chrome,[0,0.43,0.18],[0,0.43,0],0.02,10);
    b.box(M.switchWhite,0.34,0.46,0.19,0,1.65,0.08);b.box(M.paper,0.25,0.12,0.007,0,1.37,0.13);b.pop();
    solid('lab_waschbecken',-2.2,0.72,-11.85,0.4,0.6,0.3);
    equipment('lab_plotter','Schneideplotter',-2.05,0,-12.88,Math.PI/2,()=>addPlotter(b,M),1.22,0.55,1.1);
    table('lab_pressentisch',-2.06,0,-14.0,0.75,0.6,Math.PI/2);
    equipment('lab_transferpresse','Transferpresse',-2.06,0.75,-14,Math.PI/2,()=>addHeatPress(b,M));
    equipment('lab_folienregal','Folienregal',-2.08,0,-15.25,Math.PI/2,()=>{
      addCubby(b,M,{width:1.55,height:0.8,depth:0.57,cols:4});
      for(let row=0;row<2;row++)for(let col=0;col<4;col++){
        const x=-0.57+col*0.38,y=0.13+row*0.38;
        b.cylinder([M.labSpoolPink,M.labSpoolCyan,M.paper,M.labSpoolYellow,M.red][(row*4+col)%5],0.06,0.06,0.48,x,y,0,12,Math.PI/2);
        b.cylinder(M.cardboard,0.038,0.038,0.49,x,y,0,12,Math.PI/2);
      }
      b.box(M.switchWhite,0.65,0.16,0.4,0.37,0.9,0);b.box(M.black,0.48,0.04,0.23,0.37,0.86,0.25);
      b.box(M.switchWhite,0.56,0.06,0.36,-0.35,0.84,0);plane(M.labPanda,0.51,0.3,-0.35,0.874,0,0,-Math.PI/2);
    },1.55,0.57,0.8);
    equipment('lab_materialregal','Materialfächer und Lasertisch',-0.23,0,-14.2,-Math.PI/2,()=>{
      addCubby(b,M,{width:3.35,height:0.82,depth:0.62,cols:8});
      for(let i=0;i<8;i++)for(let row=0;row<2;row++)b.box(i%3?M.pine:M.paper,0.35,0.035+0.01*(i%3),0.49,-1.46+i*0.418,0.06+row*0.4,0);
    },3.35,0.62,0.82);
    equipment('lab_lasercutter','xTool-Lasercutter',-0.23,0.82,-15.15,-Math.PI/2,()=>addLaser(b,M));
    b.push(-0.23,0,-13.55,-Math.PI/2);addLabPC(b,M,{y:0.82,z:-0.05});b.pop();
    equipment('lab_kappenpresse','Kappenpresse',-0.23,0.82,-15.95,-Math.PI/2,()=>addHeatPress(b,M,{cap:true}));
    // Abluft bis zur Einsatzplatte im rechten oberen Fensterfeld.
    const hose=[[0.02,1.0,-15.15],[0.02,1.7,-15.15],[-0.03,2.3,-15.15],[-0.38,2.4,-15.6],[-0.38,2.6,-16.34]];
    const curve=new THREE.CatmullRomCurve3(hose.map(p=>new THREE.Vector3(...p)));
    perim.add(M.labRubber,new THREE.TubeGeometry(curve,50,0.07,10,false));
    perim.cylinder(M.black,0.095,0.095,0.24,0.02,2.1,-15.15,14);
    perim.box(M.switchWhite,0.48,0.48,0.02,-0.38,2.64,-16.37);
    for(let i=0;i<32;i++){
      const t=i/31,p=curve.getPoint(t),tangent=curve.getTangent(t);
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),tangent);
      perim.add(M.podcastPlastic,new THREE.TorusGeometry(0.071,0.004,4,10),new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1)));
    }
    // Zwei lange Regalböden, Folienrollen, Kisten und blaue Werkzeugboxen.
    for(const y of [1.48,1.98]){
      b.box(M.tableWhite,0.3,0.025,3.7,-2.22,y,-14.3);
      for(const z of [-12.65,-13.7,-14.75,-15.8]){
        b.box(M.aluminium,0.018,0.8,0.025,-2.4,1.67,z);b.rod(M.aluminium,[-2.4,y-0.18,z],[-2.1,y-0.02,z],0.008,6);
      }
    }
    for(const [i,z] of [-13,-13.65,-14.5,-15.3].entries()){
      b.box(i%2?M.labBlue:M.cardboard,0.23,0.14,0.43,-2.22,2.06,z);
      b.cylinder(M.paper,0.045,0.045,0.55,-2.22,1.54,z,12,Math.PI/2);
    }
    b.cylinder(M.red,0.065,0.065,0.35,-1.75,0.2,-16.0,14);b.box(M.black,0.06,0.03,0.07,-1.75,0.41,-16);
    b.cylinder(M.binBlack,0.14,0.11,0.35,-1.95,0.175,-11.37,14);
    for(const z of [-10.1,-11.55])b.box(M.cardboard,0.3,0.3,0.4,-0.5,0.15,z);
  }
  function buildCeilingAndServices(){
    // Quadratische Leuchtfelder und unterschiedliche Akzentfarben in beiden Raumteilen.
    function panel(x,z,color=null){
      fixtures.box(color||M.labLight,0.575,0.015,0.575,x,H-0.016,z);
      if(!color)for(const sx of [-1,1]){
        fixtures.box(M.lightHousing,0.012,0.021,0.59,x+sx*0.29,H-0.014,z);
        fixtures.box(M.lightHousing,0.59,0.021,0.012,x,H-0.014,z+sx*0.29);
      }
    }
    for(let x=-12.3;x<-3;x+=1.8)for(const z of [-12.3,-14.1,-16.5]){
      panel(x,z);if(z===-16.5){panel(x-0.6,z,M.labYellow);panel(x+0.6,z,M.labYellow);}
    }
    for(const z of [-8.7,-11.1,-13.5,-15.3]){panel(-0.9,z);panel(-0.9,z-0.6,M.labRed);}
    panel(-3.9,-9.3);panel(-3.9,-11.1);
    for(const [x,z,power,distance] of [[-4.1,-9.7,9,4.5],[-5,-14,18,6],[-8.3,-14,18,6],[-11.6,-14,18,6],[-1.2,-10.6,12,4.5],[-1.2,-14.6,12,4.5]]){
      const light=new THREE.PointLight(0xfff8ed,power,distance,2);light.position.set(x,H-0.23,z);root.add(light);lights.push(light);
    }
    // Strom-/Datenkanäle und wiederkehrende Steckdosen.
    // Südkanal endet vor der Zarge der Hallentür (Öffnung ab x = −11,77), vorher ragte er hinein.
    for(const [x,z,len,ry] of [[-8.525,-11.46,6.35,Math.PI],[-6.8,-17.05,7.6,0],[-2.68,-14.4,3.6,-Math.PI/2],[-2.4,-13.9,4.2,Math.PI/2],[0.05,-13.45,5.4,-Math.PI/2]]){
      const y=x<-2.65&&z<-14?Y+0.98:1.02;
      perim.push(x,y,z,ry);perim.box(M.duct,len,0.14,0.045,0,0,0);
      for(let u=-len/2+0.25;u<len/2;u+=0.85){addSwitchPlate(perim,M,u,0,0.035,0,true);addSwitchPlate(perim,M,u+0.09,0,0.035,0,true);}perim.pop();
    }
    for(const [x,z,ry] of [[-2.648,-13.0,-Math.PI/2],[-13.512,-15.7,1.667]]){
      const clock=createWallClock(M);clock.position.set(x,2.62,z);clock.rotation.y=ry;root.add(clock);
    }
    for(const x of [-12.5,-3.05]){
      perim.box(M.switchWhite,0.2,0.28,0.12,x,2.86,-16.98);perim.box(M.podcastGrille,0.15,0.21,0.008,x,2.86,-16.91);
    }
    // Beamer, Deckenlautsprecher und Melder.
    b.rod(M.black,[-11.25,H,-13.5],[-11.25,2.88,-13.5],0.025,10);
    b.box(M.switchWhite,0.33,0.13,0.25,-11.25,2.83,-13.5);b.cylinder(M.black,0.035,0.035,0.03,-11.08,2.83,-13.5,14,0,0,Math.PI/2);
    for(const [x,z] of [[-8,-14],[-4,-12],[-1.2,-12.8]]){
      b.cylinder(M.switchWhite,0.05,0.05,0.025,x,H-0.03,z,14);
      b.cylinder(M.labCabinet,0.09,0.09,0.008,x+0.22,H-0.009,z,16);
    }
    perim.box(M.labCabinet,0.45,0.5,0.35,-4.9,2.55,-8.4);
    for(let i=0;i<6;i++)perim.box(M.black,0.38,0.025,0.015,-4.9,2.45+i*0.045,-8.21);
    for(let i=0;i<4;i++)addCable(perim,M,[[-4.9+i*0.04,2.45,-8.2],[-4.8,2.3,-8.16],[-4.85+i*0.04,2.1,-8.2]]);
    const sb=new PartBuilder();addSwitchPlate(sb,M,0,1.12,0,Math.PI);addSwitchPlate(sb,M,0,1.02,0,Math.PI);
    const sw=sb.build({name:'lichtschalter_futurelab'});sw.position.set(-4.62,0,F.entrySouth-0.015);root.add(sw);
    registerObject('lichtschalter_futurelab','switch','Future-Lab-Licht',sw);
    interactions.register(sw,{id:'lichtschalter_futurelab',type:'switch',label:()=>lighting.isOn('licht_futurelab')?'Future-Lab-Licht ausschalten':'Future-Lab-Licht einschalten',onInteract:()=>{lighting.toggle('licht_futurelab');audio.click();}});
    lighting.addCircuit('licht_futurelab',{lights,panels:[M.labLight],on:true,
      regions:[[F.westNorth-0.22,F.north-0.1,F.divider,F.hallDoor.z-0.1],
        [F.entryWest-0.22,F.south,F.divider,F.foyerDoor.z-0.11],[F.divider,F.workshopNorth-0.22,F.east+0.1,F.foyerDoor.z-0.11]]});
    lighting.addDaylight(root,'licht_futurelab',{position:[-8.1,2.25,F.north-0.65],intensity:18,distance:8});
    lighting.addDaylight(root,'licht_futurelab',{position:[-0.95,2.2,F.workshopNorth-0.65],intensity:8,distance:6});
  }
}

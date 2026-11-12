// Kleine, nahtlos wiederholbare Oberflächen nach den Außenfotos; keine Originalfotos.
import * as THREE from 'three';
export function addAussenMaterials(M,{std,toTexture,makeCanvas,random}){
  const noise=(g,r,n,amp=22)=>{const d=g.getImageData(0,0,n,n),a=d.data;for(let i=0;i<a.length;i+=4){const v=(r()-.5)*amp;for(let j=0;j<3;j++)a[i+j]+=v;}g.putImageData(d,0,0);};
  const relief=(c,scale)=>{const t=toTexture(c),b=toTexture(c,{color:false});return std({map:t,bumpMap:b,bumpScale:scale,roughness:.95});};
  {
    const[c,g]=makeCanvas(1024,1024),r=random(513),s=64;
    g.fillStyle='#4d5047';g.fillRect(0,0,1024,1024);
    // Dominoverband: horizontale Steine in Restklassen 0/1, vertikale in 3/2.
    for(let j=-2;j<18;j++)for(let i=-2;i<18;i++){
      const t=((i-j)%4+4)%4;if(t!==0&&t!==3)continue;
      const x=i*s+1.8,y=j*s+1.8,w=(t===0?2:1)*s-3.6,h=(t===0?1:2)*s-3.6;
      const v=130+r()*26;g.fillStyle=`rgb(${v+6},${v+4},${v-3})`;g.fillRect(x,y,w,h);
      g.strokeStyle='rgba(229,225,209,.22)';g.lineWidth=2;g.strokeRect(x+2,y+2,w-4,h-4);
      for(let k=0;k<18;k++){g.fillStyle=r()<.5?'rgba(33,38,30,.10)':'rgba(221,216,197,.12)';g.beginPath();g.ellipse(x+r()*w,y+r()*h,3+r()*10,2+r()*8,r()*6,0,6.284);g.fill();}
    }noise(g,r,1024,27);M.hofPaving=relief(c,.012);
  }
  {
    const[c,g]=makeCanvas(1024,1024),r=random(612);
    g.fillStyle='#8a8672';g.fillRect(0,0,1024,1024);
    // Versetzte, unregelmäßige Bruchsteine statt rechteckiger Streifen.
    const seeds=[];for(let j=0;j<12;j++)for(let i=0;i<8;i++)seeds.push({x:(i+.15+r()*.7)*128,y:(j+.12+r()*.76)*1024/12,v:143+r()*40});
    const points=[];for(const p of seeds)for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)points.push({...p,x:p.x+a*1024,y:p.y+b*1024});
    for(const p of points){
      if(p.x< -150||p.x>1174||p.y< -150||p.y>1174)continue;
      let poly=[[p.x-200,p.y-200],[p.x+200,p.y-200],[p.x+200,p.y+200],[p.x-200,p.y+200]];
      for(const q of points){
        const dx=q.x-p.x,dy=q.y-p.y;if(!dx&&!dy||Math.abs(dx)>350||Math.abs(dy)>350)continue;
        const bound=(q.x*q.x+q.y*q.y-p.x*p.x-p.y*p.y)/2,next=[];
        for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*dx+a[1]*dy-bound,db=b[0]*dx+b[1]*dy-bound;
          if(da<=0)next.push(a);if((da<=0)!==(db<=0)){const t=da/(da-db);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}
        poly=next;if(!poly.length)break;
      }
      if(!poly.length)continue;
      g.save();g.beginPath();poly.forEach(([x,y],i)=>{x=p.x+(x-p.x)*.93;y=p.y+(y-p.y)*.93;i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();
      g.fillStyle=`rgb(${p.v+9},${p.v+4},${p.v-15})`;g.fill();g.clip();
      for(let k=0;k<90;k++){const x=p.x+(r()-.5)*210,y=p.y+(r()-.5)*145;g.fillStyle=r()<.5?'rgba(61,58,44,.11)':'rgba(241,230,191,.18)';g.beginPath();g.ellipse(x,y,2+r()*13,1+r()*6,r()*6,0,6.284);g.fill();}
      g.restore();
    }noise(g,r,1024,23);M.hofStone=relief(c,.018);
  }
  {
    const[c,g]=makeCanvas(512,512),r=random(902);g.fillStyle='#c0bba8';g.fillRect(0,0,512,512);
    for(let i=0;i<300;i++){const x=r()*512,y=r()*512,rad=5+r()*35;const gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,r()<.6?'rgba(64,69,44,.12)':'rgba(243,236,214,.17)');gr.addColorStop(1,'transparent');g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);}noise(g,r,512,19);M.hofOldPlaster=relief(c,.016);
    M.hofBase=M.hofOldPlaster.clone();M.hofBase.color.setHex(0x686a52);
  }
  M.hofPlaster=M.flur2Wall.clone();M.hofPlaster.color.setHex(0xf0eee5);
  M.hofMetal=std({color:0x8c9697,roughness:.58,metalness:.55});
  M.hofFrame=std({color:0xc0c6c6,roughness:.52,metalness:.24});
  M.hofGlass=std({color:0x556c70,roughness:.3,metalness:.25});
  M.hofBlue=std({color:0x3a819f,roughness:.52,metalness:.2});
  M.hofRoof=std({color:0x544f46,roughness:.94});
  M.hofCoping=std({color:0x775c48,roughness:1});
  M.hofSoil=std({color:0x494233,roughness:1});
  M.hofBark=std({map:M.tex.bark,color:0x8c8771,roughness:1,bumpMap:M.tex.bark,bumpScale:.025});
  M.hofSeatColors=[0x272f2c,0x19649b,0x912e3e,0x748881,0x294635].map(color=>std({color,roughness:.64,metalness:.2}));
  {
    const[c,g]=makeCanvas(128,128);g.fillStyle='#d3d6d1';g.fillRect(0,0,128,128);g.globalCompositeOperation='destination-out';
    for(let y=4;y<128;y+=8)for(let x=4;x<128;x+=8){g.beginPath();g.arc(x,y,2.1,0,6.284);g.fill();}
    M.hofPerforated=std({map:toTexture(c),color:0x242e2a,roughness:.67,metalness:.4,alphaTest:.5,side:THREE.DoubleSide});
  }
  // Ein Blattbüschel statt vieler tausend einzelner Blattmeshes. Variation über Instanzfarben.
  {
    const[c,g]=makeCanvas(256,256),r=random(736);
    // Zusammenhängende Zweige mit Blattrippen, wenigen gelblichen Herbstblättern.
    for(let branch=0;branch<3;branch++) {
      const bx=49+branch*76,by=230-branch*14;
      g.strokeStyle='#747348';g.lineWidth=1.7;g.beginPath();g.moveTo(bx,by);g.quadraticCurveTo(bx+10,120,bx-18,24);g.stroke();
      for(let row=0;row<5;row++)for(const side of [-1,1]) {
        const y=by-25-row*33,x=bx+side*(13+r()*12)-row*2,l=12+r()*10;
        g.save();g.translate(x,y);g.rotate(side*(.55+r()*.5));
        const color=['#6f824c','#728347','#526e3c','#83934e','#a69b51'][(row+branch+(side>0?1:0))%5];
        const shade=g.createLinearGradient(-l,0,l,0);shade.addColorStop(0,'#465b32');shade.addColorStop(.5,color);shade.addColorStop(1,'#839454');
        g.fillStyle=shade;g.beginPath();g.moveTo(0,-l);g.bezierCurveTo(l*.72,-l*.38,l*.58,l*.55,0,l);g.bezierCurveTo(-l*.55,l*.45,-l*.75,-l*.4,0,-l);g.fill();
        g.strokeStyle='rgba(192,193,118,.55)';g.lineWidth=.7;g.beginPath();g.moveTo(0,-l*.9);g.lineTo(0,l*.9);
        for(let j=-2;j<=2;j++){g.moveTo(0,j*l*.25);g.lineTo(l*.42,j*l*.25-l*.18);g.moveTo(0,j*l*.25);g.lineTo(-l*.42,j*l*.25-l*.18);}g.stroke();g.restore();
      }
    }
    M.hofFoliage=std({map:toTexture(c,{repeat:false}),roughness:.9,envMapIntensity:1.5,alphaTest:.5,side:THREE.DoubleSide});
    // Helle, graue Variante derselben Blattform: Herbstlaub/Wilder Wein werden über die Instanzfarbe eingefärbt.
    const[c2,g2]=makeCanvas(256,256);g2.filter='grayscale(1) brightness(1.75)';g2.drawImage(c,0,0);
    M.hofFoliageLight=std({map:toTexture(c2,{repeat:false}),roughness:.9,alphaTest:.5,side:THREE.DoubleSide});
  }
  {
    const[c,g]=makeCanvas(256,256),r=random(1117);
    // Kleine vierblättrige Einzelblüten bilden einen unregelmäßigen Blütenstand.
    for(let i=0;i<155;i++) {
      const angle=r()*Math.PI*2,rad=Math.sqrt(r())*104,x=128+Math.cos(angle)*rad,y=128+Math.sin(angle)*rad*.82;
      const size=3+r()*5;g.save();g.translate(x,y);g.rotate(r()*6.28);
      const v=151+r()*61;g.fillStyle=`rgb(${v+8},${v+6},${v-28})`;
      for(let petal=0;petal<4;petal++){g.rotate(Math.PI/2);g.beginPath();g.ellipse(0,size*.7,size*.65,size,0,0,Math.PI*2);g.fill();}
      g.fillStyle='#8d8a54';g.beginPath();g.arc(0,0,1.5,0,Math.PI*2);g.fill();g.restore();
    }
    M.hofBlossom=std({map:toTexture(c,{repeat:false}),roughness:1,alphaTest:.5,side:THREE.DoubleSide});
  }
  M.hofFenceSign=std({color:0xcdbe42,roughness:.8});

  // Gartenweg nach neu/1–3.jpg: rechteckige Betonsteine in Reihen (1 Kachel = 1,6 m, Reihe 14 cm).
  {
    const[c,g]=makeCanvas(1024,1024),r=random(1301),row=90;
    g.fillStyle='#4a4741';g.fillRect(0,0,1024,1024);
    for(let y=0;y<1024;y+=row){
      let x=-r()*120;
      while(x<1024){
        const w=[90,135,180][(r()*3)|0];
        const v=118+r()*34,warm=r()*14;
        const col=`rgb(${v+warm},${v+warm*.4-2},${v-8})`;
        const draw=(ox)=>{g.fillStyle=col;g.fillRect(x+ox+3,y+3,w-6,row-6);for(let k=0;k<10;k++){g.fillStyle=r()<.5?'rgba(40,42,34,.12)':'rgba(230,222,205,.12)';g.beginPath();g.ellipse(x+ox+3+r()*(w-6),y+3+r()*(row-6),3+r()*9,2+r()*6,r()*6,0,6.284);g.fill();}};
        draw(0);if(x+w>1024)draw(-1024);
        x+=w;
      }
    }
    // Moos in den Fugen
    for(let i=0;i<500;i++){g.fillStyle=`rgba(${70+r()*30},${80+r()*30},${45},.25)`;g.fillRect(r()*1024,((r()*12)|0)*row-2+(r()*4),8+r()*30,4);}
    noise(g,r,1024,22);M.hofPathPaving=relief(c,.012);
  }
  // Untere, bemooste Stützmauer vor der alten Putzmauer.
  {
    const[c,g]=makeCanvas(512,512),r=random(1402);g.fillStyle='#b3b49e';g.fillRect(0,0,512,512);
    for(let i=0;i<160;i++){const x=r()*512,w=4+r()*22;const gr=g.createLinearGradient(0,0,0,512);gr.addColorStop(0,'rgba(60,72,40,0)');gr.addColorStop(.35+r()*.4,'rgba(80,96,52,'+(.10+r()*.18)+')');gr.addColorStop(1,'rgba(70,84,46,.25)');g.fillStyle=gr;g.fillRect(x,0,w,512);}
    for(let i=0;i<220;i++){const x=r()*512,y=r()*512,rad=4+r()*24;const gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,r()<.6?'rgba(72,90,46,.22)':'rgba(214,214,196,.18)');gr.addColorStop(1,'transparent');g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);}
    noise(g,r,512,20);M.hofMossWall=relief(c,.014);
  }
  {
    const[c,g]=makeCanvas(256,256),r=random(1503);g.fillStyle='#5f7a3e';g.fillRect(0,0,256,256);
    for(let i=0;i<5000;i++){const v=r();g.fillStyle=v<.4?'rgba(126,150,78,.5)':v<.75?'rgba(70,92,44,.5)':'rgba(150,120,70,.35)';g.fillRect(r()*256,r()*256,1,2+r()*3);}
    M.hofGrass=std({map:toTexture(c),roughness:1});
  }
  {
    // Birkenrinde: weiß mit kurzen dunklen Querstrichen.
    const[c,g]=makeCanvas(64,256),r=random(1604);g.fillStyle='#e8e6de';g.fillRect(0,0,64,256);
    for(let i=0;i<46;i++){g.fillStyle=`rgba(30,28,26,${.45+r()*.4})`;g.fillRect(r()*64,r()*256,6+r()*22,1.5+r()*3.5);}
    for(let i=0;i<30;i++){g.fillStyle='rgba(150,148,138,.35)';g.fillRect(r()*64,r()*256,2,8+r()*20);}
    M.hofBirch=std({map:toTexture(c),roughness:.85});
  }
  M.hofConcrete=std({color:0xa7a69c,roughness:.9});
  M.hofHedge=std({color:0x4c6534,roughness:1});
  M.hofSteelDoor=std({color:0x7d8285,roughness:.55,metalness:.45});
  M.hofDoorBlue=std({color:0x2f4d86,roughness:.45,metalness:.15});
  M.hofLamp=std({color:0xe9ebe6,roughness:.4,metalness:.2,emissive:0xfff3d8,emissiveIntensity:.15});
}

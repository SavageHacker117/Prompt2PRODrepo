// Level10.js – end of Dungeon decile
export default {
  name:'Level 10', theme:'dungeon', required:3,
  bricks:[
    {x:-4,y:0.6,sx:1,sy:1.2,sz:1.2},
    {x:-2,y:2.0,sx:1,sy:4.0,sz:1.2},
    {x: 0,y:3.0,sx:1,sy:6.0,sz:1.2},
    {x: 2,y:2.0,sx:1,sy:4.0,sz:1.2},
    {x: 4,y:0.6,sx:1,sy:1.2,sz:1.2},
  ],
  torches:[
    {x:-3.2,y:2.6},{x:0.0,y:4.8},{x:3.2,y:2.6}
  ],
  powerups:[ {type:'longGuide', x:0.0,y:5.2}, {type:'extraShot', x:-2.0,y:3.2} ]
}

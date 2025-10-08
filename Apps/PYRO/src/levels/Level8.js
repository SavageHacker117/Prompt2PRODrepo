// Level8.js
export default {
  name:'Level 08', theme:'dungeon', required:3,
  bricks:[
    {x:-3,y:1.4,sx:1,sy:2.8,sz:1.2},
    {x:-1,y:0.7,sx:1,sy:1.4,sz:1.2},
    {x: 1,y:0.7,sx:1,sy:1.4,sz:1.2},
    {x: 3,y:1.4,sx:1,sy:2.8,sz:1.2},
    {x: 0,y:2.2,sx:1,sy:4.4,sz:1.2},
  ],
  torches:[
    {x:-2.2,y:3.0},{x:0.0,y:4.4},{x:2.2,y:3.0}
  ],
  powerups:[ {type:'extraShot', x:2.0,y:2.6} ]
}

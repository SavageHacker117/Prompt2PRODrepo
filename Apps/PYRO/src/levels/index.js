import L1 from './Level1.js'
import L2 from './Level2.js'
import L3 from './Level3.js'
import L4 from './Level4.js'
import L5 from './Level5.js'
import L6 from './Level6.js'
import L7 from './Level7.js'
import L8 from './Level8.js'
import L9 from './Level9.js'
import L10 from './Level10.js'
import L11 from './Level11.js'
import L12 from './Level12.js'
import L13 from './Level13.js'

const MAP = {1:L1,2:L2,3:L3,4:L4,5:L5,6:L6,7:L7,8:L8,9:L9,10:L10,11:L11,12:L12,13:L13}
export function getLevel(n){ return MAP[n] || L13 }

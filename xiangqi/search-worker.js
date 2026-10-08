import {search} from './engine.js';
import {validatePosition} from './position.js';
onmessage=e=>{try{const validation=validatePosition(e.data.board,e.data.side);if(!validation.canSearch)throw Error(validation.errors.join(' '));postMessage({result:search(validation.board,e.data.side,e.data.depth,e.data.options)})}catch(err){postMessage({error:err.message})}};

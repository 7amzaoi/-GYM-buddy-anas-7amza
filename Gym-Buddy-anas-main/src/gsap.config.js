import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Draggable } from 'gsap/Draggable';
import { TextPlugin } from 'gsap/TextPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, Draggable, TextPlugin, MotionPathPlugin, Flip);

export { gsap, ScrollTrigger, Draggable, TextPlugin, MotionPathPlugin, Flip };

/** The key the trail pass curtain carries across a navigation.
 *
 *  Shared because two places that cannot share a bundle read it: the module running
 *  the animation, and the inline script in the head that covers the page before it
 *  first paints. A second copy of a string like this quietly stops agreeing.
 */
export const CURTAIN_FLAG = "griffith-hiking-club:curtain";

/** The key the trail pass curtain carries across a navigation.
 *
 *  Shared, because it is read in two places that cannot share a bundle: the module
 *  that runs the animation, and a small inline script in the document head whose
 *  whole job is to cover the page before it first paints. Both have to agree, and a
 *  second copy of a string like this is exactly the sort of thing that quietly
 *  stops agreeing.
 */
export const CURTAIN_FLAG = "griffith-hiking-club:curtain";

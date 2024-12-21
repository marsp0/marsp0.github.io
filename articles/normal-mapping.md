## Normal Mapping

_21.12.2024_

In this post I'll talk about normal mapping and how I implemented it in the PBR software renderer I'm working on. Project can be found [here](https://github.com/marsp0/pbr-software-renderer).

The goal of this post is not to provide you with a step-by-step guide on how to do normal mapping; there are already plenty of those that are more helpful than what I can come up with. Instead, the goal is for me to try to explain what I have learned in a concise and clear manner. This will help me identify the gaps in my understanding and may also provide you with some additional useful information and/or a different point of view.

### Starting point

In order to understand the original idea we have to go back. Lets have a look at the below:

- Simulation of Wrinkled Surfaces - the original paper (1978) written by James Blinn that explores normal mapping on parametrically defined surfaces. It is a free paper that you can download from the ACM website - [here](https://dl.acm.org/doi/pdf/10.1145/965139.507101).
- Smooth Surfaces - pdf that contains examples of parametrically defined surfaces. Can be downloaded [here](https://courses.grainger.illinois.edu/cs418/sp2009/notes/SmoothSurfaces.pdf)


Parametrically defined surfaces possess a high degree of smoothness, which produces a characteristic plastic-like specular appearance. This paper demonstrates that by incorporating improved normals while maintaining the same lighting calculations, we can achieve a significant enhancement in the visual quality of the image. 
- parametric equation that describes the surface that we want to render. Call it `surface_point`
- parametric equation that describes the surface irregularities. Call it `normal_point`



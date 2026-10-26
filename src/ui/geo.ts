/** Converts screen coordinates into the coordinate system of the SVG viewBox. */
export function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = clientY
  const matrix = svg.getScreenCTM()
  return matrix ? point.matrixTransform(matrix.inverse()) : point
}

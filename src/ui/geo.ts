/** Convertit des coordonnées écran en coordonnées du viewBox du SVG. */
export function pointSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const m = svg.getScreenCTM()
  return m ? pt.matrixTransform(m.inverse()) : pt
}

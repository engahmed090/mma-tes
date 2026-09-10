// Angular wedge subtraction preserves a circular ring's radial gap boundaries.
export function splitRingGapMacro(name: string, radius: number, center: number, width: number, thickness: number): string[] {
  if (![radius, center, width, thickness].every(Number.isFinite) || radius <= 0 || thickness <= 0 || width <= 0 || width >= 180)
    throw new Error('Unsupported split-ring gap dimensions.');
  const halfAngle = width * Math.PI / 360;
  // Chord lies outside the outer circle, so the cutter removes the entire wedge.
  const reach = radius * 2 / Math.cos(halfAngle);
  const points = [center * Math.PI / 180 - halfAngle, center * Math.PI / 180 + halfAngle]
    .map(angle => [reach * Math.cos(angle), reach * Math.sin(angle)]);
  return [
    `    ' ${name}: gap center ${center} deg, width ${width} deg`,
    '    With Extrude', '        .Reset', `        .Name "${name}Gap"`,
    '        .Component "Component1"', '        .Material "Vacuum"',
    '        .Mode "Pointlist"', `        .Height "${thickness}"`,
    '        .Twist "0"', '        .Taper "0"', '        .Origin "0", "0", "0"',
    '        .Uvector "1", "0", "0"', '        .Vvector "0", "1", "0"',
    '        .Point "0", "0"',
    ...points.map(([x, y]) => `        .LineTo "${x.toFixed(9)}", "${y.toFixed(9)}"`),
    '        .LineTo "0", "0"', '        .Create', '    End With',
    `    Solid.Subtract "Component1:${name}", "Component1:${name}Gap"`,
  ];
}

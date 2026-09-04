//A deliberately engine-independent boundary for a later Rapier/Cannon-es implementation. It keeps rendering (Three.js) separate from simulation.

export type FailureMode = "none" | "overload" | "buckling" | "connection";

export interface BridgeLoad {
  massKg: number;
  positionX: number;
  positionZ: number;
}

export interface BridgeAssessment {
  safe: boolean;
  utilization: number;
  failure: FailureMode;
  message: string;
}

export function screenLoad(
  load: BridgeLoad,
  pillarCount: number,
  nominalPillarCapacityKg = 40_000
): BridgeAssessment {
  const capacity = pillarCount * nominalPillarCapacityKg;
  const utilization = capacity === 0 ? Infinity : load.massKg / capacity;

  return utilization <= 1
    ? { safe: true, utilization, failure: "none", message: "Passes the demo capacity screen." }
    : {
        safe: false,
        utilization,
        failure: "overload",
        message: "Over capacity: a physics engine could now release failed joints and animate collapse."
      };
}

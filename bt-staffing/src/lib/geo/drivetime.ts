import { haversineMiles, type LatLng } from "./distance";

/**
 * Drive-time interface. Today: straight-line estimate. To use a maps API
 * (Azure Maps Route Matrix, Google Distance Matrix, ...) write another class
 * that implements DriveTimeProvider and return it from getDriveTimeProvider().
 * Nothing else in the app needs to change.
 */
export interface TravelOrigin extends LatLng {
  hasCar: boolean;
}

export interface DriveTimeProvider {
  readonly name: string;
  /** Travel minutes from each origin to the destination, same order as origins. */
  minutesToDestination(origins: TravelOrigin[], destination: LatLng): Promise<number[]>;
}

/** Roads are longer than the crow flies. */
const CIRCUITY = 1.3;
const CAR_MPH = 22;
/** No car: assume transit/walking at roughly half the door-to-door speed. */
const NO_CAR_MPH = 11;

export function straightLineMinutes(origin: TravelOrigin, destination: LatLng): number {
  const miles = haversineMiles(origin, destination) * CIRCUITY;
  const mph = origin.hasCar ? CAR_MPH : NO_CAR_MPH;
  return Math.round((miles / mph) * 60);
}

export class StraightLineDriveTime implements DriveTimeProvider {
  readonly name = "straight-line";
  async minutesToDestination(origins: TravelOrigin[], destination: LatLng): Promise<number[]> {
    return origins.map((o) => straightLineMinutes(o, destination));
  }
}

let provider: DriveTimeProvider | null = null;
export function getDriveTimeProvider(): DriveTimeProvider {
  if (!provider) provider = new StraightLineDriveTime();
  return provider;
}

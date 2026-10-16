// -----------------------------------------------------------------------------
// The places to read: the located houses of Gladys and/or the coordinates of
// the configuration. A house without coordinates is skipped (Gladys gives
// `null` until the user places it on the map).
// -----------------------------------------------------------------------------

import { usesCoordinates, usesHouses } from './config.js';
import { pick, TEXT } from './i18n.js';

// The house selector is the stable identifier of a house in Gladys; it can
// only hold [a-z0-9-], kept as is in the external id.
const keyOfHouse = (house) =>
  `house-${String(house.selector)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')}`;

/**
 * @param {object} config normalized
 * @param {Array<{ name, selector, latitude, longitude }>} houses from getHouses()
 * @returns {{ places: Array<{ key, name, latitude, longitude }>, skipped: string[], badCoordinates: boolean }}
 */
export function resolvePlaces(config, houses = []) {
  const places = [];
  const skipped = [];
  if (usesHouses(config)) {
    for (const house of houses) {
      if (typeof house?.latitude === 'number' && typeof house?.longitude === 'number') {
        places.push({
          key: keyOfHouse(house),
          name: String(house.name ?? house.selector).slice(0, 40),
          latitude: house.latitude,
          longitude: house.longitude,
        });
      } else if (house?.name) {
        skipped.push(String(house.name));
      }
    }
  }
  let badCoordinates = false;
  if (usesCoordinates(config)) {
    if (config.latitude === null || config.longitude === null) {
      badCoordinates = true;
    } else {
      places.push({
        key: 'custom',
        name: config.location_name || pick(TEXT.customPlace, config.language),
        latitude: config.latitude,
        longitude: config.longitude,
      });
    }
  }
  return { places, skipped, badCoordinates };
}

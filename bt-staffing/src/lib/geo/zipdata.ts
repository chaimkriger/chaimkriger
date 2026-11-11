// Approximate ZIP centroids for the three service areas. Used by the mock
// geocoder and by the seed script. Not a complete ZIP database.
export interface ZipInfo {
  zip: string;
  city: string;
  state: "NY" | "NJ" | "CO";
  lat: number;
  lng: number;
}

const z = (zip: string, city: string, state: ZipInfo["state"], lat: number, lng: number): ZipInfo => ({
  zip, city, state, lat, lng,
});

export const ZIPS: ZipInfo[] = [
  // Brooklyn, NY
  z("11201", "Brooklyn", "NY", 40.6955, -73.9897), z("11203", "Brooklyn", "NY", 40.6495, -73.9344),
  z("11204", "Brooklyn", "NY", 40.6187, -73.9849), z("11205", "Brooklyn", "NY", 40.6947, -73.9662),
  z("11206", "Brooklyn", "NY", 40.7019, -73.9423), z("11207", "Brooklyn", "NY", 40.6707, -73.8943),
  z("11208", "Brooklyn", "NY", 40.6698, -73.8716), z("11209", "Brooklyn", "NY", 40.6216, -74.03),
  z("11210", "Brooklyn", "NY", 40.6281, -73.9463), z("11211", "Brooklyn", "NY", 40.7125, -73.953),
  z("11212", "Brooklyn", "NY", 40.6629, -73.913), z("11213", "Brooklyn", "NY", 40.6711, -73.9363),
  z("11214", "Brooklyn", "NY", 40.599, -73.9962), z("11215", "Brooklyn", "NY", 40.6627, -73.9867),
  z("11216", "Brooklyn", "NY", 40.6807, -73.9493), z("11217", "Brooklyn", "NY", 40.6824, -73.9788),
  z("11218", "Brooklyn", "NY", 40.6434, -73.9765), z("11219", "Brooklyn", "NY", 40.6326, -73.9967),
  z("11220", "Brooklyn", "NY", 40.6412, -74.0165), z("11221", "Brooklyn", "NY", 40.6914, -73.9276),
  z("11223", "Brooklyn", "NY", 40.597, -73.9734), z("11225", "Brooklyn", "NY", 40.663, -73.9542),
  z("11226", "Brooklyn", "NY", 40.6464, -73.9567), z("11229", "Brooklyn", "NY", 40.6012, -73.9441),
  z("11230", "Brooklyn", "NY", 40.6221, -73.9651), z("11233", "Brooklyn", "NY", 40.6783, -73.9199),
  z("11234", "Brooklyn", "NY", 40.605, -73.9117), z("11235", "Brooklyn", "NY", 40.5839, -73.9498),
  z("11236", "Brooklyn", "NY", 40.6394, -73.901), z("11238", "Brooklyn", "NY", 40.6791, -73.9638),
  // New Jersey
  z("07102", "Newark", "NJ", 40.7357, -74.1724), z("07103", "Newark", "NJ", 40.7369, -74.1964),
  z("07104", "Newark", "NJ", 40.7665, -74.1695), z("07105", "Newark", "NJ", 40.7235, -74.1385),
  z("07302", "Jersey City", "NJ", 40.7194, -74.0465), z("07304", "Jersey City", "NJ", 40.7163, -74.075),
  z("07305", "Jersey City", "NJ", 40.6972, -74.0823), z("07306", "Jersey City", "NJ", 40.7346, -74.0718),
  z("07030", "Hoboken", "NJ", 40.7453, -74.032), z("07201", "Elizabeth", "NJ", 40.6718, -74.1773),
  z("07202", "Elizabeth", "NJ", 40.652, -74.216), z("07501", "Paterson", "NJ", 40.9142, -74.1671),
  z("07503", "Paterson", "NJ", 40.8972, -74.1535), z("07011", "Clifton", "NJ", 40.8781, -74.1425),
  z("07055", "Passaic", "NJ", 40.8576, -74.1283), z("07087", "Union City", "NJ", 40.7674, -74.0323),
  z("07047", "North Bergen", "NJ", 40.794, -74.025), z("07601", "Hackensack", "NJ", 40.8882, -74.0457),
  z("07002", "Bayonne", "NJ", 40.6625, -74.1107), z("07017", "East Orange", "NJ", 40.7718, -74.2071),
  z("07111", "Irvington", "NJ", 40.7263, -74.2313), z("07040", "Maplewood", "NJ", 40.73, -74.271),
  z("07666", "Teaneck", "NJ", 40.8905, -74.0115), z("08817", "Edison", "NJ", 40.5147, -74.3937),
  z("08901", "New Brunswick", "NJ", 40.4895, -74.4443), z("08701", "Lakewood", "NJ", 40.0779, -74.2003),
  // Denver metro, CO
  z("80202", "Denver", "CO", 39.7528, -104.9995), z("80203", "Denver", "CO", 39.7313, -104.9819),
  z("80204", "Denver", "CO", 39.735, -105.0206), z("80205", "Denver", "CO", 39.759, -104.9663),
  z("80206", "Denver", "CO", 39.7302, -104.9525), z("80207", "Denver", "CO", 39.7614, -104.9165),
  z("80209", "Denver", "CO", 39.7065, -104.9686), z("80210", "Denver", "CO", 39.679, -104.9631),
  z("80211", "Denver", "CO", 39.7669, -105.02), z("80212", "Denver", "CO", 39.7718, -105.0483),
  z("80219", "Denver", "CO", 39.6953, -105.0345), z("80220", "Denver", "CO", 39.7337, -104.9163),
  z("80222", "Denver", "CO", 39.6711, -104.9279), z("80223", "Denver", "CO", 39.7001, -105.003),
  z("80227", "Denver", "CO", 39.6667, -105.0892), z("80231", "Denver", "CO", 39.6717, -104.8878),
  z("80239", "Denver", "CO", 39.788, -104.83), z("80010", "Aurora", "CO", 39.7386, -104.8627),
  z("80012", "Aurora", "CO", 39.6989, -104.8376), z("80013", "Aurora", "CO", 39.6612, -104.766),
  z("80014", "Aurora", "CO", 39.6635, -104.837), z("80110", "Englewood", "CO", 39.6461, -105.01),
  z("80214", "Lakewood", "CO", 39.743, -105.0706), z("80226", "Lakewood", "CO", 39.7106, -105.0862),
  z("80003", "Arvada", "CO", 39.8262, -105.0646), z("80221", "Denver", "CO", 39.838, -105.009),
  z("80229", "Thornton", "CO", 39.856, -104.957), z("80233", "Northglenn", "CO", 39.899, -104.947),
  z("80120", "Littleton", "CO", 39.5936, -105.009),
];

export const ZIP_INDEX: Map<string, ZipInfo> = new Map(ZIPS.map((x) => [x.zip, x]));

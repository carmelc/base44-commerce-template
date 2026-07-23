/**
 * Static geographic reference data for pickers (mirror of base44/shared/commerce/data/*.ts).
 * Countries: ISO 3166-1 alpha-2. States included for US / CA / AU; other
 * countries accept free-text state input in AddressForm.
 */

const c = (code, name, states) => (states ? { code, name, states } : { code, name });
const s = (code, name) => ({ code, name });

export const US_STATES = [
  s("AL", "Alabama"), s("AK", "Alaska"), s("AZ", "Arizona"), s("AR", "Arkansas"),
  s("CA", "California"), s("CO", "Colorado"), s("CT", "Connecticut"), s("DE", "Delaware"),
  s("DC", "District of Columbia"), s("FL", "Florida"), s("GA", "Georgia"), s("HI", "Hawaii"),
  s("ID", "Idaho"), s("IL", "Illinois"), s("IN", "Indiana"), s("IA", "Iowa"),
  s("KS", "Kansas"), s("KY", "Kentucky"), s("LA", "Louisiana"), s("ME", "Maine"),
  s("MD", "Maryland"), s("MA", "Massachusetts"), s("MI", "Michigan"), s("MN", "Minnesota"),
  s("MS", "Mississippi"), s("MO", "Missouri"), s("MT", "Montana"), s("NE", "Nebraska"),
  s("NV", "Nevada"), s("NH", "New Hampshire"), s("NJ", "New Jersey"), s("NM", "New Mexico"),
  s("NY", "New York"), s("NC", "North Carolina"), s("ND", "North Dakota"), s("OH", "Ohio"),
  s("OK", "Oklahoma"), s("OR", "Oregon"), s("PA", "Pennsylvania"), s("RI", "Rhode Island"),
  s("SC", "South Carolina"), s("SD", "South Dakota"), s("TN", "Tennessee"), s("TX", "Texas"),
  s("UT", "Utah"), s("VT", "Vermont"), s("VA", "Virginia"), s("WA", "Washington"),
  s("WV", "West Virginia"), s("WI", "Wisconsin"), s("WY", "Wyoming"),
];

export const CA_PROVINCES = [
  s("AB", "Alberta"), s("BC", "British Columbia"), s("MB", "Manitoba"),
  s("NB", "New Brunswick"), s("NL", "Newfoundland and Labrador"), s("NT", "Northwest Territories"),
  s("NS", "Nova Scotia"), s("NU", "Nunavut"), s("ON", "Ontario"),
  s("PE", "Prince Edward Island"), s("QC", "Quebec"), s("SK", "Saskatchewan"), s("YT", "Yukon"),
];

export const AU_STATES = [
  s("ACT", "Australian Capital Territory"), s("NSW", "New South Wales"),
  s("NT", "Northern Territory"), s("QLD", "Queensland"), s("SA", "South Australia"),
  s("TAS", "Tasmania"), s("VIC", "Victoria"), s("WA", "Western Australia"),
];

export const COUNTRIES = [
  c("AF", "Afghanistan"), c("AX", "Åland Islands"), c("AL", "Albania"), c("DZ", "Algeria"),
  c("AS", "American Samoa"), c("AD", "Andorra"), c("AO", "Angola"), c("AI", "Anguilla"),
  c("AQ", "Antarctica"), c("AG", "Antigua and Barbuda"), c("AR", "Argentina"), c("AM", "Armenia"),
  c("AW", "Aruba"), c("AU", "Australia", AU_STATES), c("AT", "Austria"), c("AZ", "Azerbaijan"),
  c("BS", "Bahamas"), c("BH", "Bahrain"), c("BD", "Bangladesh"), c("BB", "Barbados"),
  c("BY", "Belarus"), c("BE", "Belgium"), c("BZ", "Belize"), c("BJ", "Benin"),
  c("BM", "Bermuda"), c("BT", "Bhutan"), c("BO", "Bolivia"), c("BQ", "Bonaire, Sint Eustatius and Saba"),
  c("BA", "Bosnia and Herzegovina"), c("BW", "Botswana"), c("BV", "Bouvet Island"), c("BR", "Brazil"),
  c("IO", "British Indian Ocean Territory"), c("BN", "Brunei Darussalam"), c("BG", "Bulgaria"), c("BF", "Burkina Faso"),
  c("BI", "Burundi"), c("CV", "Cabo Verde"), c("KH", "Cambodia"), c("CM", "Cameroon"),
  c("CA", "Canada", CA_PROVINCES), c("KY", "Cayman Islands"), c("CF", "Central African Republic"), c("TD", "Chad"),
  c("CL", "Chile"), c("CN", "China"), c("CX", "Christmas Island"), c("CC", "Cocos (Keeling) Islands"),
  c("CO", "Colombia"), c("KM", "Comoros"), c("CG", "Congo"), c("CD", "Congo, Democratic Republic of the"),
  c("CK", "Cook Islands"), c("CR", "Costa Rica"), c("CI", "Côte d'Ivoire"), c("HR", "Croatia"),
  c("CU", "Cuba"), c("CW", "Curaçao"), c("CY", "Cyprus"), c("CZ", "Czechia"),
  c("DK", "Denmark"), c("DJ", "Djibouti"), c("DM", "Dominica"), c("DO", "Dominican Republic"),
  c("EC", "Ecuador"), c("EG", "Egypt"), c("SV", "El Salvador"), c("GQ", "Equatorial Guinea"),
  c("ER", "Eritrea"), c("EE", "Estonia"), c("SZ", "Eswatini"), c("ET", "Ethiopia"),
  c("FK", "Falkland Islands"), c("FO", "Faroe Islands"), c("FJ", "Fiji"), c("FI", "Finland"),
  c("FR", "France"), c("GF", "French Guiana"), c("PF", "French Polynesia"), c("TF", "French Southern Territories"),
  c("GA", "Gabon"), c("GM", "Gambia"), c("GE", "Georgia"), c("DE", "Germany"),
  c("GH", "Ghana"), c("GI", "Gibraltar"), c("GR", "Greece"), c("GL", "Greenland"),
  c("GD", "Grenada"), c("GP", "Guadeloupe"), c("GU", "Guam"), c("GT", "Guatemala"),
  c("GG", "Guernsey"), c("GN", "Guinea"), c("GW", "Guinea-Bissau"), c("GY", "Guyana"),
  c("HT", "Haiti"), c("HM", "Heard Island and McDonald Islands"), c("VA", "Holy See"), c("HN", "Honduras"),
  c("HK", "Hong Kong"), c("HU", "Hungary"), c("IS", "Iceland"), c("IN", "India"),
  c("ID", "Indonesia"), c("IR", "Iran"), c("IQ", "Iraq"), c("IE", "Ireland"),
  c("IM", "Isle of Man"), c("IL", "Israel"), c("IT", "Italy"), c("JM", "Jamaica"),
  c("JP", "Japan"), c("JE", "Jersey"), c("JO", "Jordan"), c("KZ", "Kazakhstan"),
  c("KE", "Kenya"), c("KI", "Kiribati"), c("KP", "Korea, North"), c("KR", "Korea, South"),
  c("KW", "Kuwait"), c("KG", "Kyrgyzstan"), c("LA", "Lao People's Democratic Republic"), c("LV", "Latvia"),
  c("LB", "Lebanon"), c("LS", "Lesotho"), c("LR", "Liberia"), c("LY", "Libya"),
  c("LI", "Liechtenstein"), c("LT", "Lithuania"), c("LU", "Luxembourg"), c("MO", "Macao"),
  c("MG", "Madagascar"), c("MW", "Malawi"), c("MY", "Malaysia"), c("MV", "Maldives"),
  c("ML", "Mali"), c("MT", "Malta"), c("MH", "Marshall Islands"), c("MQ", "Martinique"),
  c("MR", "Mauritania"), c("MU", "Mauritius"), c("YT", "Mayotte"), c("MX", "Mexico"),
  c("FM", "Micronesia"), c("MD", "Moldova"), c("MC", "Monaco"), c("MN", "Mongolia"),
  c("ME", "Montenegro"), c("MS", "Montserrat"), c("MA", "Morocco"), c("MZ", "Mozambique"),
  c("MM", "Myanmar"), c("NA", "Namibia"), c("NR", "Nauru"), c("NP", "Nepal"),
  c("NL", "Netherlands"), c("NC", "New Caledonia"), c("NZ", "New Zealand"), c("NI", "Nicaragua"),
  c("NE", "Niger"), c("NG", "Nigeria"), c("NU", "Niue"), c("NF", "Norfolk Island"),
  c("MK", "North Macedonia"), c("MP", "Northern Mariana Islands"), c("NO", "Norway"), c("OM", "Oman"),
  c("PK", "Pakistan"), c("PW", "Palau"), c("PS", "Palestine, State of"), c("PA", "Panama"),
  c("PG", "Papua New Guinea"), c("PY", "Paraguay"), c("PE", "Peru"), c("PH", "Philippines"),
  c("PN", "Pitcairn"), c("PL", "Poland"), c("PT", "Portugal"), c("PR", "Puerto Rico"),
  c("QA", "Qatar"), c("RE", "Réunion"), c("RO", "Romania"), c("RU", "Russian Federation"),
  c("RW", "Rwanda"), c("BL", "Saint Barthélemy"), c("SH", "Saint Helena"), c("KN", "Saint Kitts and Nevis"),
  c("LC", "Saint Lucia"), c("MF", "Saint Martin (French part)"), c("PM", "Saint Pierre and Miquelon"), c("VC", "Saint Vincent and the Grenadines"),
  c("WS", "Samoa"), c("SM", "San Marino"), c("ST", "Sao Tome and Principe"), c("SA", "Saudi Arabia"),
  c("SN", "Senegal"), c("RS", "Serbia"), c("SC", "Seychelles"), c("SL", "Sierra Leone"),
  c("SG", "Singapore"), c("SX", "Sint Maarten (Dutch part)"), c("SK", "Slovakia"), c("SI", "Slovenia"),
  c("SB", "Solomon Islands"), c("SO", "Somalia"), c("ZA", "South Africa"), c("GS", "South Georgia and the South Sandwich Islands"),
  c("SS", "South Sudan"), c("ES", "Spain"), c("LK", "Sri Lanka"), c("SD", "Sudan"),
  c("SR", "Suriname"), c("SJ", "Svalbard and Jan Mayen"), c("SE", "Sweden"), c("CH", "Switzerland"),
  c("SY", "Syrian Arab Republic"), c("TW", "Taiwan"), c("TJ", "Tajikistan"), c("TZ", "Tanzania"),
  c("TH", "Thailand"), c("TL", "Timor-Leste"), c("TG", "Togo"), c("TK", "Tokelau"),
  c("TO", "Tonga"), c("TT", "Trinidad and Tobago"), c("TN", "Tunisia"), c("TR", "Türkiye"),
  c("TM", "Turkmenistan"), c("TC", "Turks and Caicos Islands"), c("TV", "Tuvalu"), c("UG", "Uganda"),
  c("UA", "Ukraine"), c("AE", "United Arab Emirates"), c("GB", "United Kingdom"), c("US", "United States", US_STATES),
  c("UM", "United States Minor Outlying Islands"), c("UY", "Uruguay"), c("UZ", "Uzbekistan"), c("VU", "Vanuatu"),
  c("VE", "Venezuela"), c("VN", "Viet Nam"), c("VG", "Virgin Islands (British)"), c("VI", "Virgin Islands (U.S.)"),
  c("WF", "Wallis and Futuna"), c("EH", "Western Sahara"), c("YE", "Yemen"), c("ZM", "Zambia"),
  c("ZW", "Zimbabwe"),
];

export const CONTINENTS = [
  { code: "AF", name: "Africa", countries: ["DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU","YT","MA","MZ","NA","NE","NG","RE","RW","SH","ST","SN","SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","EH","ZM","ZW"] },
  { code: "AN", name: "Antarctica", countries: ["AQ","BV","GS","HM","TF"] },
  { code: "AS", name: "Asia", countries: ["AF","AM","AZ","BH","BD","BT","BN","KH","CN","CY","GE","HK","IN","ID","IR","IQ","IL","JP","JO","KZ","KP","KR","KW","KG","LA","LB","MO","MY","MV","MN","MM","NP","OM","PK","PS","PH","QA","SA","SG","LK","SY","TW","TJ","TH","TL","TR","TM","AE","UZ","VN","YE"] },
  { code: "EU", name: "Europe", countries: ["AX","AL","AD","AT","BY","BE","BA","BG","HR","CZ","DK","EE","FO","FI","FR","DE","GI","GR","GG","VA","HU","IS","IE","IM","IT","JE","LV","LI","LT","LU","MT","MD","MC","ME","NL","MK","NO","PL","PT","RO","RU","SM","RS","SK","SI","ES","SJ","SE","CH","UA","GB"] },
  { code: "NA", name: "North America", countries: ["AI","AG","AW","BS","BB","BZ","BM","BQ","CA","KY","CR","CU","CW","DM","DO","SV","GL","GD","GP","GT","HT","HN","JM","MQ","MX","MS","NI","PA","PR","BL","KN","LC","MF","PM","VC","SX","TT","TC","US","UM","VG","VI"] },
  { code: "OC", name: "Oceania", countries: ["AS","AU","CX","CC","CK","FJ","PF","GU","KI","MH","FM","NR","NC","NZ","NU","NF","MP","PW","PG","PN","WS","SB","TK","TO","TV","VU","WF"] },
  { code: "SA", name: "South America", countries: ["AR","BO","BR","CL","CO","EC","FK","GF","GY","PY","PE","SR","UY","VE"] },
];

export function countryByCode(code) {
  return COUNTRIES.find((x) => x.code === code) || null;
}

export function countryName(code) {
  return countryByCode(code)?.name || code || "";
}

export function statesFor(code) {
  return countryByCode(code)?.states || null;
}

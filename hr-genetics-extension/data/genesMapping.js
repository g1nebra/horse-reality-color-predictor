// Breed genetics mapping, ES module to avoid JSON import assertion syntax
// (assert/with) compatibility issues in Chrome MV3.

export default {
  "Akhal-Teke": {
    "visible": ["E","e","A","G","CR","nd1"],
    "hidden": ["A+","At","STY","f"],
    "whites": ["rb","Y","WM"],
    "none": ["PA","prl","CH","Z","mu","OLW","LP","PATN1","PATN2","TO","SB1","RN","W20"]
  },
  "Arabian Horse": {
    "visible": ["E","e","A","G"],
    "hidden": ["A+","At","f","STY"],
    "whites": ["rb","Y","WM","W3","W19"],
    "none": ["prl","CR","D","CH","Z","mu","OLW","LP","PATN1","PATN2","MITF","SW2","TO","SB1","RN","W10","W20","W21","nd1","PA"]
  },
  "Brabant Horse": {
    "visible": ["E","e","A","G"],
    "hidden": ["At","PA","f","STY"],
    "whites": ["RN","WM"],
    "none": ["A+","CR","prl","D","nd1","CH","Z","mu","OLW","LP","rb","Y","TO","SB1","W20"]
  },
  "Brumby": {
    "visible": ["E","e","A","G","CR","D","Z"],
    "hidden": ["A+","At","f","PA","STY"],
    "whites": ["TO","RN","WM"],
    "none": ["prl","CH","mu","OLW","LP","PATN1","PATN2","MITF","SW2","SB1","W3","W10","W19","W21","Y","W20","rb"]
  },
  "Camargue Horse": {
    "visible": ["E","e","A","G"],
    "hidden": ["At","f"],
    "whites": ["WM"],
    "none": ["A+","PA","STY","CR","prl","D","nd1","CH","Z","mu","OLW","LP","TO","SB1","RN","W20"]
  },
  "Cleveland Bay": {
    "visible": ["E","e","A"],
    "hidden": ["At","f","STY"],
    "whites": ["WM"],
    "none": ["A+","PA","CR","prl","D","nd1","CH","Z","mu","OLW","LP","rb","Y","TO","SB1","RN","W20","G"]
  },
  "Exmoor Pony": {
    "visible": ["A","D"],
    "hidden": ["At","STY","PA"],
    "whites": [],
    "none": ["A+","f","CR","prl","CH","Z","mu","OLW","LP","WM","rb","Y","TO","SB1","RN","W20","G"],
    "fixed": { "E": ["E","E"] }
  },
  "Finnhorse": {
    "visible": ["E","e","A","CR","Z","G"],
    "hidden": ["At","f","PA","STY"],
    "whites": ["MITF","WM","rb","Y","RN"],
    "none": ["A+","prl","CH","mu","OLW","LP","PATN1","PATN2","TO","SB1","W20"]
  },
  "Fjord Horse": {
    "visible": ["E","e","A","CR","D","PA"],
    "hidden": [],
    "whites": [],
    "none": ["A+","At","f","STY","prl","CH","Z","mu","OLW","LP","rb","Y","TO","SB1","RN","W20","G"]
  },
  "Friesian Horse": {
    "visible": ["E","e"],
    "hidden": ["f","STY"],
    "whites": ["WM"],
    "none": ["A","A+","At","PA","CR","prl","D","nd1","CH","Z","mu","OLW","LP","rb","Y","TO","SB1","RN","W20","G"],
    "fixed": { "A": ["a","a"] }
  },
  "Haflinger Horse": {
    "visible": ["e","A","nd1"],
    "hidden": ["A+","f","PA","STY"],
    "whites": ["WM","rb"],
    "none": ["E","At","G","CR","prl","D","CH","Z","mu","OLW","LP","TO","RN"],
    "fixed": { "E": ["e","e"], "f": ["f","f"] }
  },
  "Icelandic Horse": {
    "visible": ["E","e","A","G","D","nd1","Z","CR"],
    "hidden": ["At","f","PA","STY"],
    "whites": ["MITF","WM","TO","RN","W8","W21"],
    "none": ["prl","CH","mu","OLW","LP","PATN1","PATN2","rb","Y","SB1","W20"]
  },
  "Irish Cob": {
    "visible": ["E","e","A","CR","prl","Z","D","G"],
    "hidden": ["At","f","PA","STY"],
    "whites": ["WM","TO","SB1","RN","LP","MITF"],
    "none": ["A+","CH","mu","OLW","rb","Y"]
  },
  "Kathiawari": {
    "visible": ["E","e","A","G","CR","D","nd1"],
    "hidden": ["A+","At","f","STY"],
    "whites": ["MITF","WM","Y"],
    "none": []
  },
  "Kladruber": {
    "visible": ["E","e","A","G"],
    "hidden": ["At","f","STY"],
    "whites": ["WM","rb"],
    "none": ["A+","PA","CR","prl","D","nd1","CH","Z","mu","OLW","LP","PATN1","PATN2","TO","Y","SB1","RN","W20"]
  },
  "Knabstrupper": {
    "visible": ["E","e","A","D","nd1"],
    "hidden": ["At","f","STY"],
    "whites": ["LP","PATN1","PATN2","WM","RN"],
    "none": ["PA","prl","CH","mu","OLW","rb","Y","TO","SB1","G"]
  },
  "Lipizzaner": {
    "visible": ["E","e","A","G","CR","nd1"],
    "hidden": ["f","STY"],
    "whites": ["WM","Y","RN","W20"],
    "none": ["A+","PA","D","CH","Z","mu","sno","OLW","LP","PATN1","PATN2","rb","TO","SB1"]
  },
  "Lusitano": {
    "visible": ["E","e","A","G","CR","prl","nd1"],
    "hidden": ["At","f","STY"],
    "whites": ["WM"],
    "none": ["A+","PA","CH","Z","mu","OLW","LP","PATN1","PATN2","TO","SB1"]
  },
  "Mongolian Horse": {
    "visible": ["E","e","A","G","CR","D","nd1"],
    "hidden": ["A+","At","f","PA","STY"],
    "whites": ["LP","PATN1","PATN2","MITF","WM","TO","RN"],
    "none": ["prl","CH","Z","mu","OLW","rb","Y","SB1","W20"]
  },
  "Mustang": {
    "visible": ["E","e","A","CR","prl","D","CH","Z"],
    "hidden": ["A+","At","f","PA","STY"],
    "whites": ["OLW","WM","TO","RN"],
    "none": ["mu","G"]
  },
  "Namib Desert Horse": {
    "visible": ["E","e","A","nd1"],
    "hidden": ["A+","At","f","PA","STY"],
    "whites": ["WM"],
    "none": ["CR","prl","D","CH","Z","mu","OLW","LP","PATN1","PATN2","rb","Y","TO","SB1","RN","W20","G"]
  },
  "Noriker": {
    "visible": ["E","e","A"],
    "hidden": ["At","f","STY"],
    "whites": ["LP","PATN1","PATN2","WM","Y","TO","RN"],
    "none": ["A+","PA","CR","prl","D","nd1","CH","Z","mu","OLW","rb","G"],
    "fixed": { "f": ["f","f"] }
  },
  "Norman Cob": {
    "visible": ["E","e","A","G"],
    "hidden": ["At","f","STY"],
    "whites": ["WM"],
    "none": ["A+","PA","CR","prl","D","nd1","CH","Z","mu","OLW","LP","PATN1","PATN2","rb","TO","SB1","RN","W20"]
  },
  "Oldenburg": {
    "visible": ["E","e","A","G","CR","nd1"],
    "hidden": ["At","f","STY"],
    "whites": ["WM","TO","W16"],
    "none": ["A+","PA","prl","D","CH","Z","mu","OLW","LP","PATN1","PATN2","rb","Y","SB1","RN"]
  },
  "Pantaneiro": {
    "visible": ["E","e","A","G","CR","D","nd1"],
    "hidden": ["At","f","STY"],
    "whites": ["WM","RN"],
    "none": ["A+","PA","prl","CH","mu","LP","PATN1","PATN2","rb","Y","TO","SB1","W20"]
  },
  "Pura Raza Española": {
    "visible": ["E","e","A","G","CR","prl"],
    "hidden": ["At","f"],
    "whites": ["WM","rb"],
    "none": ["A+","PA","CH","Z","mu","OLW","LP","PATN1","PATN2","Y","TO","SB1","RN"]
  },
  "Quarter Horse": {
    "visible": ["E","e","A","CR","prl","D","CH","Z"],
    "hidden": ["A+","At","f"],
    "whites": ["OLW","LP","PATN1","MITF","SW2","WM","rb","RN","W10"],
    "none": ["PA","mu","Y","TO","G"]
  },
  "Shetland Pony": {
    "visible": ["E","e","A","G","CR","D","nd1","Z","mu"],
    "hidden": ["A+","At","f","PA","STY"],
    "whites": ["MITF","WM","TO","SB1","RN"],
    "none": ["prl","CH","OLW","LP","PATN1","PATN2","Y"]
  },
  "Shire Horse": {
    "visible": ["E","e","A","G","CR"],
    "hidden": ["At","f","STY"],
    "whites": ["WM","Y","W20"],
    "none": ["A+","PA","prl","D","nd1","CH","Z","mu","OLW","LP","PATN1","PATN2","rb","TO","SB1","RN"]
  },
  "Suffolk Punch": {
    "visible": ["A"],
    "hidden": ["At","f","STY"],
    "whites": ["WM"],
    "none": ["E","A+","PA","CR","prl","D","nd1","CH","Z","mu","OLW","LP","PATN1","PATN2","rb","Y","TO","SB1","RN","W20","G"],
    "fixed": { "E": ["e","e"] }
  },
  "Thoroughbred": {
    "visible": ["E","e","A","G","CR","nd1"],
    "hidden": ["A+","At","f","STY"],
    "whites": ["OLW","WM","rb","RN"],
    "none": ["PA","prl","D","CH","Z","mu","LP","PATN1","PATN2","Y","TO","SB1"]
  },
  "Trakehner Horse": {
    "visible": ["E","e","A","G","CR"],
    "hidden": ["At","f","STY"],
    "whites": ["WM","TO","RN","MITF"],
    "none": ["A+","PA","prl","D","nd1","CH","Z","mu","OLW","LP","PATN1","PATN2","rb","SB1","W20"]
  },
  "Welsh Pony": {
    "visible": ["E","e","A","CR","G","D","Z"],
    "hidden": ["At","f","STY"],
    "whites": ["WM","MITF","RN","Y","rb"],
    "none": ["A+","prl","CH","mu","OLW","LP","PATN1","PATN2","TO","SB1"]
  }
};

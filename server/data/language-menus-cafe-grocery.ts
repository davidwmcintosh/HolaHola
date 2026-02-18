export type MenuSections = {
  sections: Array<{
    name: string;
    name_target: string;
    items: Array<{
      name: string;
      name_target: string;
      price: string;
      description_target: string;
    }>;
  }>;
};

export const coffeeShopMenus: Record<string, Record<string, MenuSections>> = {
  spanish: {
    beginner: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Bebidas Calientes",
          items: [
            { name: "Espresso", name_target: "Café solo", price: "€1.50", description_target: "Café negro intenso" },
            { name: "Latte", name_target: "Café con leche", price: "€2.80", description_target: "Café con leche caliente" },
            { name: "Hot Chocolate", name_target: "Chocolate caliente", price: "€3.00", description_target: "Chocolate espeso tradicional" }
          ]
        },
        {
          name: "Pastries",
          name_target: "Bollería",
          items: [
            { name: "Croissant", name_target: "Cruasán", price: "€1.80", description_target: "Cruasán de mantequilla" },
            { name: "Toast with Tomato", name_target: "Tostada con tomate", price: "€2.50", description_target: "Pan tostado con tomate y aceite" },
            { name: "Churros", name_target: "Churros", price: "€3.00", description_target: "Churros con azúcar" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Bebidas Calientes",
          items: [
            { name: "Espresso", name_target: "Café solo", price: "€1.50", description_target: "Café negro intenso servido en taza pequeña" },
            { name: "Latte", name_target: "Café con leche", price: "€2.80", description_target: "Café con leche caliente y espuma suave" },
            { name: "Cappuccino", name_target: "Capuchino", price: "€3.00", description_target: "Café con espuma de leche abundante" },
            { name: "Cortado", name_target: "Cortado", price: "€1.80", description_target: "Café solo con un poco de leche" }
          ]
        },
        {
          name: "Cold Drinks",
          name_target: "Bebidas Frías",
          items: [
            { name: "Iced Coffee", name_target: "Café con hielo", price: "€2.80", description_target: "Café solo servido con hielo aparte" },
            { name: "Fresh Orange Juice", name_target: "Zumo de naranja natural", price: "€3.50", description_target: "Zumo recién exprimido de naranjas valencianas" },
            { name: "Horchata", name_target: "Horchata", price: "€3.20", description_target: "Bebida refrescante de chufa valenciana" }
          ]
        },
        {
          name: "Pastries & Snacks",
          name_target: "Bollería y Aperitivos",
          items: [
            { name: "Churros with Chocolate", name_target: "Churros con chocolate", price: "€4.50", description_target: "Churros recién hechos con chocolate espeso" },
            { name: "Spanish Omelette Sandwich", name_target: "Pincho de tortilla", price: "€3.50", description_target: "Porción de tortilla española de patata" },
            { name: "Ham Toast", name_target: "Tostada con jamón", price: "€3.80", description_target: "Pan tostado con jamón serrano y tomate" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Coffee Specialties",
          name_target: "Especialidades de Café",
          items: [
            { name: "Espresso", name_target: "Café solo", price: "€1.50", description_target: "Café de tueste natural servido en taza de porcelana" },
            { name: "Latte", name_target: "Café con leche", price: "€2.80", description_target: "Café con leche entera de ganadería local" },
            { name: "Cortado", name_target: "Cortado", price: "€1.80", description_target: "Café solo manchado con un toque de leche caliente" },
            { name: "Carajillo", name_target: "Carajillo", price: "€3.50", description_target: "Café solo con un chorro de brandy o licor de anís" },
            { name: "Barraquito", name_target: "Barraquito", price: "€4.00", description_target: "Especialidad canaria con leche condensada, licor y canela" }
          ]
        },
        {
          name: "Cold Beverages",
          name_target: "Bebidas Frías",
          items: [
            { name: "Iced Coffee", name_target: "Café con hielo", price: "€2.80", description_target: "Café de especialidad servido con hielo artesanal" },
            { name: "Horchata", name_target: "Horchata de chufa", price: "€3.50", description_target: "Bebida artesanal de chufa con denominación de origen valenciana" },
            { name: "Fresh Orange Juice", name_target: "Zumo de naranja natural", price: "€3.50", description_target: "Zumo recién exprimido de naranjas de temporada" },
            { name: "Lemon Granita", name_target: "Granizado de limón", price: "€3.00", description_target: "Granizado natural de limón siciliano" }
          ]
        },
        {
          name: "Breakfast & Snacks",
          name_target: "Desayunos y Aperitivos",
          items: [
            { name: "Churros with Chocolate", name_target: "Churros con chocolate", price: "€4.50", description_target: "Media docena de churros artesanales con chocolate a la taza" },
            { name: "Spanish Omelette", name_target: "Tortilla española", price: "€4.00", description_target: "Tortilla de patata jugosa con cebolla caramelizada" },
            { name: "Tomato Toast", name_target: "Tostada con tomate", price: "€3.00", description_target: "Pan de pueblo con tomate rallado y aceite de oliva virgen extra" },
            { name: "Ham Croquettes", name_target: "Croquetas de jamón", price: "€5.00", description_target: "Croquetas caseras de jamón ibérico con bechamel cremosa" },
            { name: "Bikini Sandwich", name_target: "Bikini", price: "€4.50", description_target: "Sándwich caliente de jamón york y queso fundido al estilo catalán" }
          ]
        },
        {
          name: "Seasonal Specials",
          name_target: "Especialidades de Temporada",
          items: [
            { name: "Roscón Slice", name_target: "Porción de roscón", price: "€3.50", description_target: "Porción del tradicional roscón de Reyes con nata" },
            { name: "Pestiños", name_target: "Pestiños", price: "€2.80", description_target: "Dulces fritos andaluces bañados en miel de romero" },
            { name: "Ensaimada", name_target: "Ensaimada", price: "€3.00", description_target: "Bollo espiral mallorquín espolvoreado con azúcar glas" },
            { name: "Torrijas", name_target: "Torrijas", price: "€3.50", description_target: "Pan empapado en leche con canela, frito y azucarado" }
          ]
        }
      ]
    }
  },
  french: {
    beginner: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Boissons Chaudes",
          items: [
            { name: "Espresso", name_target: "Café express", price: "€1.80", description_target: "Café noir court" },
            { name: "Coffee with Cream", name_target: "Café crème", price: "€3.50", description_target: "Café avec lait chaud et mousse" },
            { name: "Hot Chocolate", name_target: "Chocolat chaud", price: "€4.00", description_target: "Chocolat chaud onctueux" }
          ]
        },
        {
          name: "Pastries",
          name_target: "Viennoiseries",
          items: [
            { name: "Croissant", name_target: "Croissant", price: "€1.50", description_target: "Croissant au beurre" },
            { name: "Chocolate Pastry", name_target: "Pain au chocolat", price: "€1.80", description_target: "Viennoiserie au chocolat noir" },
            { name: "Butter Tartine", name_target: "Tartine beurrée", price: "€2.00", description_target: "Pain grillé avec beurre et confiture" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Boissons Chaudes",
          items: [
            { name: "Espresso", name_target: "Café express", price: "€1.80", description_target: "Café noir serré en petite tasse" },
            { name: "Coffee with Cream", name_target: "Café crème", price: "€3.50", description_target: "Café avec lait chaud et mousse légère" },
            { name: "Café Allongé", name_target: "Café allongé", price: "€2.50", description_target: "Café long avec eau chaude" },
            { name: "Tea", name_target: "Thé", price: "€3.00", description_target: "Sélection de thés fins en feuilles" }
          ]
        },
        {
          name: "Cold Drinks",
          name_target: "Boissons Fraîches",
          items: [
            { name: "Fresh Lemonade", name_target: "Citron pressé", price: "€3.50", description_target: "Jus de citron frais pressé avec sucre" },
            { name: "Mint Syrup Water", name_target: "Diabolo menthe", price: "€3.00", description_target: "Limonade avec sirop de menthe" },
            { name: "Iced Coffee", name_target: "Café glacé", price: "€4.00", description_target: "Café froid avec glaçons et crème" }
          ]
        },
        {
          name: "Pastries & Light Bites",
          name_target: "Viennoiseries et Snacks",
          items: [
            { name: "Croque-Monsieur", name_target: "Croque-monsieur", price: "€6.50", description_target: "Sandwich chaud au jambon et fromage gratiné" },
            { name: "Quiche Lorraine", name_target: "Quiche lorraine", price: "€5.50", description_target: "Tarte salée aux lardons et crème" },
            { name: "Pain au Chocolat", name_target: "Pain au chocolat", price: "€1.80", description_target: "Pâte feuilletée avec barres de chocolat noir" },
            { name: "Almond Croissant", name_target: "Croissant aux amandes", price: "€2.80", description_target: "Croissant garni de crème d'amande et effilé" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Coffee & Tea",
          name_target: "Cafés et Thés",
          items: [
            { name: "Espresso", name_target: "Café express", price: "€1.80", description_target: "Café torréfié artisanalement, servi en tasse en porcelaine" },
            { name: "Coffee with Cream", name_target: "Café crème", price: "€3.50", description_target: "Café avec lait entier moussé à la vapeur" },
            { name: "Café Noisette", name_target: "Café noisette", price: "€2.20", description_target: "Café express avec une touche de lait chaud" },
            { name: "Café Viennois", name_target: "Café viennois", price: "€5.00", description_target: "Café surmonté de chantilly maison et copeaux de chocolat" },
            { name: "Earl Grey", name_target: "Thé Earl Grey", price: "€3.50", description_target: "Thé noir parfumé à la bergamote en feuilles entières" }
          ]
        },
        {
          name: "Cold Beverages",
          name_target: "Boissons Fraîches",
          items: [
            { name: "Fresh Lemonade", name_target: "Citron pressé", price: "€3.50", description_target: "Citrons frais pressés minute avec sucre de canne" },
            { name: "Iced Coffee", name_target: "Café glacé", price: "€4.50", description_target: "Infusion froide de café arabica avec glaçons" },
            { name: "Mint Syrup Water", name_target: "Diabolo menthe", price: "€3.00", description_target: "Limonade artisanale avec sirop de menthe fraîche" },
            { name: "Apricot Nectar", name_target: "Nectar d'abricot", price: "€3.50", description_target: "Jus d'abricot du Roussillon" }
          ]
        },
        {
          name: "Savory Items",
          name_target: "Salé",
          items: [
            { name: "Croque-Monsieur", name_target: "Croque-monsieur", price: "€7.00", description_target: "Pain de mie gratiné au jambon blanc et béchamel au gruyère" },
            { name: "Croque-Madame", name_target: "Croque-madame", price: "€8.00", description_target: "Croque-monsieur surmonté d'un œuf au plat" },
            { name: "Quiche Lorraine", name_target: "Quiche lorraine", price: "€6.00", description_target: "Pâte brisée maison garnie de lardons fumés et crème fraîche" },
            { name: "Salade Niçoise", name_target: "Salade niçoise", price: "€9.00", description_target: "Salade provençale au thon, œuf dur, olives et anchois" }
          ]
        },
        {
          name: "Pastries & Desserts",
          name_target: "Pâtisseries et Desserts",
          items: [
            { name: "Pain au Chocolat", name_target: "Pain au chocolat", price: "€1.80", description_target: "Pâte feuilletée pur beurre avec chocolat grand cru" },
            { name: "Almond Croissant", name_target: "Croissant aux amandes", price: "€2.80", description_target: "Croissant garni de frangipane et amandes effilées torréfiées" },
            { name: "Tarte Tatin", name_target: "Tarte Tatin", price: "€5.50", description_target: "Tarte aux pommes caramélisées renversée, servie tiède" },
            { name: "Paris-Brest", name_target: "Paris-Brest", price: "€6.00", description_target: "Pâte à choux pralinée avec crème mousseline aux noisettes" },
            { name: "Mille-feuille", name_target: "Mille-feuille", price: "€5.50", description_target: "Feuilletage croustillant et crème pâtissière à la vanille de Madagascar" }
          ]
        }
      ]
    }
  },
  german: {
    beginner: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Heißgetränke",
          items: [
            { name: "Coffee with Milk", name_target: "Milchkaffee", price: "€3.50", description_target: "Kaffee mit heißer Milch" },
            { name: "Espresso", name_target: "Espresso", price: "€2.00", description_target: "Starker schwarzer Kaffee" },
            { name: "Hot Chocolate", name_target: "Heiße Schokolade", price: "€3.80", description_target: "Heiße Schokolade mit Sahne" }
          ]
        },
        {
          name: "Pastries",
          name_target: "Gebäck",
          items: [
            { name: "Pretzel", name_target: "Brezel", price: "€1.50", description_target: "Frische Laugenbrezel mit Salz" },
            { name: "Bread Roll", name_target: "Brötchen", price: "€1.20", description_target: "Knuspriges Weizenbrötchen" },
            { name: "Apple Strudel", name_target: "Apfelstrudel", price: "€3.80", description_target: "Warmer Strudel mit Äpfeln" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Heißgetränke",
          items: [
            { name: "Coffee with Milk", name_target: "Milchkaffee", price: "€3.50", description_target: "Frisch gebrühter Kaffee mit heißer Milch" },
            { name: "Cappuccino", name_target: "Cappuccino", price: "€3.80", description_target: "Espresso mit aufgeschäumter Milch" },
            { name: "Latte Macchiato", name_target: "Latte Macchiato", price: "€4.00", description_target: "Geschichtetes Milchkaffeegetränk im Glas" },
            { name: "Herbal Tea", name_target: "Kräutertee", price: "€3.00", description_target: "Auswahl an heimischen Kräutertees" }
          ]
        },
        {
          name: "Cold Drinks",
          name_target: "Kaltgetränke",
          items: [
            { name: "Apple Juice Spritzer", name_target: "Apfelschorle", price: "€3.00", description_target: "Apfelsaft mit Sprudelwasser gemischt" },
            { name: "Iced Coffee", name_target: "Eiskaffee", price: "€4.50", description_target: "Kalter Kaffee mit Vanilleeis und Sahne" },
            { name: "Sparkling Water", name_target: "Sprudel", price: "€2.50", description_target: "Mineralwasser mit Kohlensäure" }
          ]
        },
        {
          name: "Pastries & Snacks",
          name_target: "Gebäck und Snacks",
          items: [
            { name: "Pretzel", name_target: "Brezel", price: "€1.50", description_target: "Bayerische Laugenbrezel frisch gebacken" },
            { name: "Black Forest Cherry Cake", name_target: "Schwarzwälder Kirschtorte", price: "€4.50", description_target: "Schokoladentorte mit Kirschen und Sahne" },
            { name: "Butter Croissant", name_target: "Buttercroissant", price: "€2.00", description_target: "Blätterteiggebäck mit Butter" },
            { name: "Ham and Cheese Roll", name_target: "Schinken-Käse-Brötchen", price: "€3.50", description_target: "Brötchen belegt mit Schinken und Käse" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Coffee Specialties",
          name_target: "Kaffeespezialitäten",
          items: [
            { name: "Filter Coffee", name_target: "Filterkaffee", price: "€2.80", description_target: "Handgefilterter Kaffee aus frisch gemahlenen Bohnen" },
            { name: "Viennese Melange", name_target: "Wiener Melange", price: "€4.00", description_target: "Espresso mit aufgeschäumter Milch nach Wiener Art" },
            { name: "Pharisee Coffee", name_target: "Pharisäer", price: "€5.50", description_target: "Kaffee mit Rum und einer Sahnehaube" },
            { name: "Eiskaffee", name_target: "Eiskaffee", price: "€5.00", description_target: "Kalter Kaffee mit zwei Kugeln Vanilleeis und Schlagsahne" }
          ]
        },
        {
          name: "Tea & Other Drinks",
          name_target: "Tee und Andere Getränke",
          items: [
            { name: "East Frisian Tea", name_target: "Ostfriesentee", price: "€3.80", description_target: "Schwarztee mit Kluntje und Sahne nach ostfriesischer Tradition" },
            { name: "Apple Juice Spritzer", name_target: "Apfelschorle", price: "€3.00", description_target: "Naturtrüber Apfelsaft mit Sprudel" },
            { name: "Hot Spiced Wine", name_target: "Glühwein", price: "€4.00", description_target: "Rotwein mit Gewürzen und Orangenschale (saisonal)" },
            { name: "Rhubarb Spritzer", name_target: "Rhabarberschorle", price: "€3.50", description_target: "Hausgemachter Rhabarbersirup mit Sprudelwasser" }
          ]
        },
        {
          name: "Breakfast & Savory",
          name_target: "Frühstück und Herzhaftes",
          items: [
            { name: "Pretzel with Butter", name_target: "Butterbrezel", price: "€2.50", description_target: "Ofenfrische Laugenbrezel mit gesalzener Butter" },
            { name: "Ham and Cheese Roll", name_target: "Schinken-Käse-Brötchen", price: "€3.80", description_target: "Mehrkornbrötchen mit gekochtem Schinken und Gouda" },
            { name: "Leberkäse Roll", name_target: "Leberkässemmel", price: "€4.00", description_target: "Bayerische Semmel mit einer Scheibe warmem Leberkäse und Senf" },
            { name: "Strammer Max", name_target: "Strammer Max", price: "€6.50", description_target: "Brot mit Schinken und Spiegelei, dazu saure Gurke" }
          ]
        },
        {
          name: "Cakes & Pastries",
          name_target: "Kuchen und Gebäck",
          items: [
            { name: "Black Forest Cherry Cake", name_target: "Schwarzwälder Kirschtorte", price: "€4.80", description_target: "Traditionelle Torte mit Schokolade, Sauerkirschen und Kirschwasser" },
            { name: "Apple Strudel", name_target: "Apfelstrudel", price: "€4.50", description_target: "Hauchdünner Strudelteig mit Äpfeln, Rosinen und Zimt" },
            { name: "Bee Sting Cake", name_target: "Bienenstich", price: "€4.00", description_target: "Hefekuchen mit karamellisierter Mandelkruste und Vanillecreme" },
            { name: "Poppy Seed Cake", name_target: "Mohnkuchen", price: "€3.80", description_target: "Saftiger Kuchen mit gemahlener Mohnfüllung" },
            { name: "Plum Tart", name_target: "Zwetschgendatschi", price: "€4.00", description_target: "Bayerischer Pflaumenkuchen auf Hefeteig mit Streuseln" }
          ]
        }
      ]
    }
  },
  italian: {
    beginner: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Bevande Calde",
          items: [
            { name: "Espresso", name_target: "Caffè espresso", price: "€1.20", description_target: "Caffè nero intenso" },
            { name: "Cappuccino", name_target: "Cappuccino", price: "€1.80", description_target: "Caffè con latte e schiuma" },
            { name: "Hot Chocolate", name_target: "Cioccolata calda", price: "€3.00", description_target: "Cioccolata densa e cremosa" }
          ]
        },
        {
          name: "Pastries",
          name_target: "Pasticceria",
          items: [
            { name: "Cornetto", name_target: "Cornetto", price: "€1.50", description_target: "Brioche dolce a forma di mezzaluna" },
            { name: "Sfogliatella", name_target: "Sfogliatella", price: "€2.00", description_target: "Pasta sfoglia ripiena di ricotta" },
            { name: "Slice of Cake", name_target: "Fetta di torta", price: "€3.50", description_target: "Torta del giorno" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Coffee",
          name_target: "Caffetteria",
          items: [
            { name: "Espresso", name_target: "Caffè espresso", price: "€1.20", description_target: "Caffè ristretto servito in tazzina di ceramica" },
            { name: "Cappuccino", name_target: "Cappuccino", price: "€1.80", description_target: "Caffè con latte montato a vapore" },
            { name: "Macchiato", name_target: "Caffè macchiato", price: "€1.40", description_target: "Caffè espresso con una goccia di latte caldo" },
            { name: "Caffè Americano", name_target: "Caffè americano", price: "€2.00", description_target: "Caffè lungo con acqua calda" }
          ]
        },
        {
          name: "Cold Drinks",
          name_target: "Bevande Fredde",
          items: [
            { name: "Iced Coffee", name_target: "Caffè freddo", price: "€2.50", description_target: "Caffè freddo shakerato con ghiaccio" },
            { name: "Granita", name_target: "Granita al limone", price: "€3.00", description_target: "Granita siciliana al limone fresco" },
            { name: "Fresh Juice", name_target: "Spremuta d'arancia", price: "€3.50", description_target: "Arance spremute al momento" }
          ]
        },
        {
          name: "Snacks & Pastries",
          name_target: "Pasticceria e Spuntini",
          items: [
            { name: "Cornetto with Jam", name_target: "Cornetto alla marmellata", price: "€1.80", description_target: "Cornetto farcito con marmellata di albicocche" },
            { name: "Tramezzino", name_target: "Tramezzino", price: "€3.00", description_target: "Panino morbido triangolare con prosciutto e formaggio" },
            { name: "Cannolo", name_target: "Cannolo siciliano", price: "€3.50", description_target: "Cialda croccante ripiena di ricotta dolce" },
            { name: "Focaccia", name_target: "Focaccia", price: "€2.50", description_target: "Focaccia ligure con olio d'oliva e sale grosso" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Coffee Menu",
          name_target: "Caffetteria",
          items: [
            { name: "Espresso", name_target: "Caffè espresso", price: "€1.20", description_target: "Miscela arabica al 100% con tostatura artigianale" },
            { name: "Cappuccino", name_target: "Cappuccino", price: "€1.80", description_target: "Caffè con crema di latte vellutata e cacao in polvere" },
            { name: "Caffè Shakerato", name_target: "Caffè shakerato", price: "€3.00", description_target: "Caffè espresso agitato con ghiaccio e zucchero di canna" },
            { name: "Marocchino", name_target: "Marocchino", price: "€2.50", description_target: "Caffè con schiuma di latte e polvere di cacao in bicchierino" },
            { name: "Caffè Corretto", name_target: "Caffè corretto", price: "€2.50", description_target: "Espresso con un goccio di grappa o sambuca" }
          ]
        },
        {
          name: "Cold Beverages",
          name_target: "Bevande Fredde",
          items: [
            { name: "Granita with Brioche", name_target: "Granita con brioche", price: "€4.50", description_target: "Granita siciliana di mandorla servita con brioche calda" },
            { name: "Iced Coffee", name_target: "Caffè freddo shakerato", price: "€3.00", description_target: "Caffè freddo preparato allo shaker con ghiaccio tritato" },
            { name: "Blood Orange Juice", name_target: "Spremuta di arancia rossa", price: "€4.00", description_target: "Arance rosse di Sicilia spremute al momento" },
            { name: "Chinotto", name_target: "Chinotto", price: "€2.50", description_target: "Bevanda agrumata amara tipica italiana" }
          ]
        },
        {
          name: "Sweet Pastries",
          name_target: "Pasticceria Dolce",
          items: [
            { name: "Cornetto", name_target: "Cornetto alla crema", price: "€1.80", description_target: "Cornetto sfogliato ripieno di crema pasticcera alla vaniglia" },
            { name: "Cannolo", name_target: "Cannolo siciliano", price: "€3.50", description_target: "Cialda croccante con ricotta di pecora, canditi e pistacchio di Bronte" },
            { name: "Pastiera", name_target: "Pastiera napoletana", price: "€4.00", description_target: "Torta tradizionale napoletana con ricotta, grano e acqua di fiori d'arancio" },
            { name: "Baba", name_target: "Babà al rum", price: "€3.50", description_target: "Dolce napoletano lievitato, bagnato nel rum e servito con panna" }
          ]
        },
        {
          name: "Savory Snacks",
          name_target: "Spuntini Salati",
          items: [
            { name: "Tramezzino", name_target: "Tramezzino misto", price: "€3.50", description_target: "Tramezzino veneziano con tonno, uova sode e maionese" },
            { name: "Focaccia", name_target: "Focaccia di Recco", price: "€4.00", description_target: "Focaccia sottile ligure ripiena di formaggio stracchino" },
            { name: "Arancini", name_target: "Arancini al ragù", price: "€3.00", description_target: "Palle di riso fritte ripiene di ragù, piselli e mozzarella" },
            { name: "Piadina", name_target: "Piadina romagnola", price: "€5.00", description_target: "Pane piatto romagnolo con prosciutto crudo, squacquerone e rucola" }
          ]
        }
      ]
    }
  },
  portuguese: {
    beginner: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Bebidas Quentes",
          items: [
            { name: "Espresso", name_target: "Café expresso", price: "R$5,00", description_target: "Café preto forte" },
            { name: "Coffee with Milk", name_target: "Café com leite", price: "R$7,00", description_target: "Café com leite quente" },
            { name: "Hot Chocolate", name_target: "Chocolate quente", price: "R$9,00", description_target: "Chocolate quente cremoso" }
          ]
        },
        {
          name: "Snacks",
          name_target: "Lanches",
          items: [
            { name: "Cheese Bread", name_target: "Pão de queijo", price: "R$5,00", description_target: "Pãozinho de queijo mineiro" },
            { name: "Custard Tart", name_target: "Pastel de nata", price: "R$6,00", description_target: "Torta de creme portuguesa" },
            { name: "Mixed Sandwich", name_target: "Misto quente", price: "R$8,00", description_target: "Sanduíche de presunto e queijo" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Coffee",
          name_target: "Cafés",
          items: [
            { name: "Espresso", name_target: "Café expresso", price: "R$5,00", description_target: "Café preto encorpado e aromático" },
            { name: "Galão", name_target: "Galão", price: "R$8,00", description_target: "Café com bastante leite em copo grande" },
            { name: "Pingado", name_target: "Pingado", price: "R$6,00", description_target: "Leite quente com um pingo de café" },
            { name: "Cappuccino", name_target: "Cappuccino", price: "R$9,00", description_target: "Café com espuma de leite e canela" }
          ]
        },
        {
          name: "Cold Drinks",
          name_target: "Bebidas Geladas",
          items: [
            { name: "Açaí Juice", name_target: "Suco de açaí", price: "R$12,00", description_target: "Suco natural de açaí da Amazônia" },
            { name: "Passion Fruit Juice", name_target: "Suco de maracujá", price: "R$8,00", description_target: "Suco natural de maracujá" },
            { name: "Coconut Water", name_target: "Água de coco", price: "R$7,00", description_target: "Água de coco natural gelada" }
          ]
        },
        {
          name: "Snacks & Pastries",
          name_target: "Lanches e Salgados",
          items: [
            { name: "Cheese Bread", name_target: "Pão de queijo", price: "R$5,00", description_target: "Pão de queijo mineiro feito com polvilho" },
            { name: "Coxinha", name_target: "Coxinha", price: "R$7,00", description_target: "Salgado de frango desfiado em massa crocante" },
            { name: "Custard Tart", name_target: "Pastel de nata", price: "R$6,00", description_target: "Massa folhada com creme de ovos" },
            { name: "Tapioca", name_target: "Tapioca", price: "R$10,00", description_target: "Crepe de tapioca com queijo e coco" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Coffee Specialties",
          name_target: "Cafés Especiais",
          items: [
            { name: "Espresso", name_target: "Café expresso", price: "R$6,00", description_target: "Café de grãos selecionados do Cerrado Mineiro" },
            { name: "Galão", name_target: "Galão", price: "R$9,00", description_target: "Café com leite vaporizado servido em copo de vidro alto" },
            { name: "Cold Brew", name_target: "Cold brew", price: "R$12,00", description_target: "Café extraído a frio por 24 horas com notas frutadas" },
            { name: "Café Mazagran", name_target: "Mazagran", price: "R$10,00", description_target: "Café gelado de origem portuguesa com limão e açúcar" }
          ]
        },
        {
          name: "Fresh Juices & Drinks",
          name_target: "Sucos e Bebidas",
          items: [
            { name: "Açaí Bowl", name_target: "Açaí na tigela", price: "R$18,00", description_target: "Açaí batido com banana, granola e mel da Amazônia" },
            { name: "Guaraná Juice", name_target: "Suco de guaraná", price: "R$9,00", description_target: "Guaraná natural da Amazônia com gelo" },
            { name: "Caldo de Cana", name_target: "Caldo de cana", price: "R$7,00", description_target: "Suco de cana-de-açúcar espremido na hora com limão" },
            { name: "Passion Fruit Caipirinha", name_target: "Caipirinha de maracujá", price: "R$15,00", description_target: "Cachaça artesanal com maracujá fresco e açúcar mascavo" }
          ]
        },
        {
          name: "Savory Pastries",
          name_target: "Salgados e Lanches",
          items: [
            { name: "Cheese Bread", name_target: "Pão de queijo", price: "R$6,00", description_target: "Tradicional pão de queijo mineiro com queijo canastra artesanal" },
            { name: "Coxinha", name_target: "Coxinha de frango", price: "R$8,00", description_target: "Salgado crocante recheado com frango desfiado e catupiry" },
            { name: "Empada", name_target: "Empadinha", price: "R$7,00", description_target: "Massa amanteigada recheada com palmito ou camarão" },
            { name: "Tapioca", name_target: "Tapioca recheada", price: "R$12,00", description_target: "Crepe de goma de mandioca com queijo coalho e carne seca" },
            { name: "Pastel", name_target: "Pastel de feira", price: "R$9,00", description_target: "Massa crocante frita recheada com carne moída e ovo" }
          ]
        },
        {
          name: "Sweets & Desserts",
          name_target: "Doces e Sobremesas",
          items: [
            { name: "Custard Tart", name_target: "Pastel de nata", price: "R$7,00", description_target: "Receita tradicional portuguesa com massa folhada e creme de ovos" },
            { name: "Brigadeiro", name_target: "Brigadeiro gourmet", price: "R$5,00", description_target: "Doce de chocolate com leite condensado e granulado belga" },
            { name: "Quindim", name_target: "Quindim", price: "R$6,00", description_target: "Doce de gema de ovo com coco e açúcar caramelizado" },
            { name: "Romeo and Juliet", name_target: "Romeu e Julieta", price: "R$8,00", description_target: "Goiabada cascão com queijo Minas artesanal" }
          ]
        }
      ]
    }
  },
  japanese: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "ドリンク",
          items: [
            { name: "Matcha Latte", name_target: "抹茶ラテ", price: "¥480", description_target: "抹茶と温かいミルク" },
            { name: "Iced Coffee", name_target: "アイスコーヒー", price: "¥350", description_target: "冷たいコーヒー" },
            { name: "Green Tea", name_target: "緑茶", price: "¥300", description_target: "温かい緑茶" }
          ]
        },
        {
          name: "Snacks",
          name_target: "軽食",
          items: [
            { name: "Rice Ball", name_target: "おにぎり", price: "¥150", description_target: "海苔で巻いたご飯" },
            { name: "Melon Bread", name_target: "メロンパン", price: "¥200", description_target: "甘いメロン風味のパン" },
            { name: "Red Bean Bun", name_target: "あんパン", price: "¥180", description_target: "あんこ入りのパン" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "ホットドリンク",
          items: [
            { name: "Matcha Latte", name_target: "抹茶ラテ", price: "¥520", description_target: "宇治抹茶と蒸したミルクのラテ" },
            { name: "Hojicha Latte", name_target: "ほうじ茶ラテ", price: "¥480", description_target: "香ばしいほうじ茶とミルク" },
            { name: "Drip Coffee", name_target: "ドリップコーヒー", price: "¥400", description_target: "挽きたての豆で淹れたコーヒー" },
            { name: "Yuzu Tea", name_target: "ゆず茶", price: "¥450", description_target: "柚子のはちみつ漬けのお茶" }
          ]
        },
        {
          name: "Cold Drinks",
          name_target: "コールドドリンク",
          items: [
            { name: "Iced Matcha", name_target: "アイス抹茶", price: "¥520", description_target: "氷で冷やした抹茶ドリンク" },
            { name: "Ramune Soda", name_target: "ラムネ", price: "¥250", description_target: "昔ながらのラムネソーダ" },
            { name: "Calpis", name_target: "カルピス", price: "¥300", description_target: "乳酸菌飲料をソーダで割ったもの" }
          ]
        },
        {
          name: "Food",
          name_target: "フード",
          items: [
            { name: "Rice Ball Set", name_target: "おにぎりセット", price: "¥350", description_target: "鮭と梅のおにぎり二個セット" },
            { name: "Egg Sandwich", name_target: "たまごサンド", price: "¥380", description_target: "ふわふわたまごのサンドイッチ" },
            { name: "Melon Bread", name_target: "メロンパン", price: "¥220", description_target: "サクサクのクッキー生地のパン" },
            { name: "Miso Soup", name_target: "味噌汁", price: "¥200", description_target: "豆腐とわかめの味噌汁" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Tea Specialties",
          name_target: "お茶の専門メニュー",
          items: [
            { name: "Premium Matcha", name_target: "特選抹茶", price: "¥680", description_target: "京都宇治の石臼挽き一番茶を使用した本格抹茶" },
            { name: "Hojicha Latte", name_target: "ほうじ茶ラテ", price: "¥520", description_target: "加賀棒茶を使用した香り高いほうじ茶ラテ" },
            { name: "Genmaicha", name_target: "玄米茶", price: "¥400", description_target: "炒り玄米と煎茶をブレンドした香ばしいお茶" },
            { name: "Sakura Tea", name_target: "桜茶", price: "¥500", description_target: "塩漬けの桜の花を使った季節限定のお茶" }
          ]
        },
        {
          name: "Coffee",
          name_target: "コーヒー",
          items: [
            { name: "Hand Drip Coffee", name_target: "ハンドドリップコーヒー", price: "¥500", description_target: "一杯ずつ丁寧にハンドドリップで淹れたシングルオリジン" },
            { name: "Kyoto Cold Brew", name_target: "京都式水出しコーヒー", price: "¥580", description_target: "十二時間かけてゆっくり抽出した水出しコーヒー" },
            { name: "Affogato", name_target: "アフォガート", price: "¥550", description_target: "バニラアイスに熱いエスプレッソをかけたデザートドリンク" },
            { name: "Soy Latte", name_target: "豆乳ラテ", price: "¥480", description_target: "国産豆乳を使用したまろやかなラテ" }
          ]
        },
        {
          name: "Light Meals",
          name_target: "軽食メニュー",
          items: [
            { name: "Onigiri Set", name_target: "おにぎり定食", price: "¥580", description_target: "日替わりおにぎり二個と味噌汁、お漬物のセット" },
            { name: "Japanese Curry Toast", name_target: "カレーパン", price: "¥280", description_target: "自家製カレーを包んで揚げたサクサクのパン" },
            { name: "Tamago Sando", name_target: "厚焼きたまごサンド", price: "¥450", description_target: "だし巻き厚焼きたまごの贅沢サンドイッチ" },
            { name: "Yakisoba Bread", name_target: "焼きそばパン", price: "¥250", description_target: "ソース焼きそばを挟んだ日本の定番パン" },
            { name: "Miso Soup Set", name_target: "味噌汁セット", price: "¥350", description_target: "季節の野菜と豆腐の味噌汁にご飯付き" }
          ]
        },
        {
          name: "Seasonal Sweets",
          name_target: "季節の甘味",
          items: [
            { name: "Matcha Parfait", name_target: "抹茶パフェ", price: "¥750", description_target: "抹茶アイス、白玉、あんこ、寒天を盛り合わせた和パフェ" },
            { name: "Dorayaki", name_target: "どら焼き", price: "¥250", description_target: "ふんわりしたカステラ生地に粒あんを挟んだ和菓子" },
            { name: "Warabi Mochi", name_target: "わらび餅", price: "¥400", description_target: "本わらび粉を使用したぷるぷるのわらび餅にきな粉添え" },
            { name: "Dango", name_target: "みたらし団子", price: "¥300", description_target: "もちもちの団子に甘辛い醤油だれをかけた三色団子" }
          ]
        }
      ]
    }
  },
  mandarin: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "饮品",
          items: [
            { name: "Soy Milk", name_target: "豆浆", price: "¥5", description_target: "新鲜热豆浆" },
            { name: "Milk Tea", name_target: "奶茶", price: "¥12", description_target: "香浓奶茶" },
            { name: "Green Tea", name_target: "绿茶", price: "¥8", description_target: "清香绿茶" }
          ]
        },
        {
          name: "Snacks",
          name_target: "小吃",
          items: [
            { name: "Fried Dough Stick", name_target: "油条", price: "¥3", description_target: "金黄酥脆的油条" },
            { name: "Steamed Bun", name_target: "包子", price: "¥4", description_target: "猪肉馅的包子" },
            { name: "Egg Pancake", name_target: "鸡蛋饼", price: "¥6", description_target: "鸡蛋煎饼" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "热饮",
          items: [
            { name: "Soy Milk", name_target: "豆浆", price: "¥6", description_target: "现磨新鲜热豆浆，可选甜或咸" },
            { name: "Milk Tea", name_target: "奶茶", price: "¥15", description_target: "台式珍珠奶茶，可选甜度" },
            { name: "Osmanthus Tea", name_target: "桂花茶", price: "¥12", description_target: "桂花龙井清香淡雅" },
            { name: "Ginger Tea", name_target: "姜茶", price: "¥10", description_target: "红糖姜茶暖胃驱寒" }
          ]
        },
        {
          name: "Cold Drinks",
          name_target: "冷饮",
          items: [
            { name: "Iced Plum Juice", name_target: "酸梅汤", price: "¥8", description_target: "传统酸梅汤冰镇解渴" },
            { name: "Bubble Tea", name_target: "珍珠奶茶", price: "¥18", description_target: "手工珍珠配鲜牛奶茶" },
            { name: "Watermelon Juice", name_target: "西瓜汁", price: "¥12", description_target: "鲜榨冰镇西瓜汁" }
          ]
        },
        {
          name: "Breakfast Items",
          name_target: "早餐",
          items: [
            { name: "Fried Dough Stick", name_target: "油条", price: "¥4", description_target: "现炸金黄酥脆油条" },
            { name: "Xiaolongbao", name_target: "小笼包", price: "¥15", description_target: "皮薄汤多的小笼包一笼" },
            { name: "Rice Porridge", name_target: "皮蛋瘦肉粥", price: "¥10", description_target: "皮蛋瘦肉白粥配油条" },
            { name: "Steamed Bun", name_target: "肉包子", price: "¥5", description_target: "新鲜猪肉馅大包子" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Tea House Specials",
          name_target: "茶馆特色",
          items: [
            { name: "Longjing Green Tea", name_target: "西湖龙井", price: "¥38", description_target: "杭州西湖明前龙井茶，清香甘醇回味悠长" },
            { name: "Pu'er Tea", name_target: "云南普洱茶", price: "¥35", description_target: "陈年普洱熟茶，醇厚顺滑带有陈香" },
            { name: "Osmanthus Oolong", name_target: "桂花乌龙", price: "¥28", description_target: "安溪铁观音配桂花，花香与茶香完美融合" },
            { name: "Chrysanthemum Tea", name_target: "菊花枸杞茶", price: "¥22", description_target: "杭白菊配宁夏枸杞，清肝明目养生茶" },
            { name: "Rose Milk Tea", name_target: "玫瑰奶茶", price: "¥20", description_target: "重瓣玫瑰与鲜奶调制的花香奶茶" }
          ]
        },
        {
          name: "Cold Beverages",
          name_target: "冰饮特调",
          items: [
            { name: "Iced Plum Juice", name_target: "老北京酸梅汤", price: "¥12", description_target: "乌梅、山楂、甘草熬制的传统酸梅汤" },
            { name: "Mango Pomelo Sago", name_target: "杨枝甘露", price: "¥25", description_target: "新鲜芒果、西柚、椰汁和西米的港式甜品" },
            { name: "Brown Sugar Boba", name_target: "黑糖珍珠鲜奶", price: "¥22", description_target: "手工熬制黑糖珍珠配鲜牛奶" },
            { name: "Coconut Water", name_target: "鲜椰子水", price: "¥15", description_target: "海南新鲜椰子现开现饮" }
          ]
        },
        {
          name: "Dim Sum & Breakfast",
          name_target: "点心早餐",
          items: [
            { name: "Xiaolongbao", name_target: "蟹粉小笼包", price: "¥28", description_target: "蟹黄蟹肉鲜汁小笼包，薄皮大馅汤汁丰富" },
            { name: "Shaomai", name_target: "烧麦", price: "¥18", description_target: "糯米烧麦配香菇和猪肉，皮薄馅香" },
            { name: "Scallion Pancake", name_target: "葱油饼", price: "¥8", description_target: "层层酥脆的手工葱油饼" },
            { name: "Congee", name_target: "海鲜砂锅粥", price: "¥25", description_target: "虾仁、鱿鱼、蟹肉砂锅慢熬海鲜粥" },
            { name: "Rice Noodle Roll", name_target: "肠粉", price: "¥15", description_target: "广式鲜虾肠粉配特制酱油" }
          ]
        },
        {
          name: "Sweet Treats",
          name_target: "甜品小食",
          items: [
            { name: "Egg Tart", name_target: "蛋挞", price: "¥8", description_target: "澳门风味酥皮蛋挞，外酥内嫩" },
            { name: "Sesame Balls", name_target: "芝麻球", price: "¥6", description_target: "外酥里糯的空心芝麻球" },
            { name: "Red Bean Cake", name_target: "红豆糕", price: "¥10", description_target: "细腻绵密的红豆沙糕点" },
            { name: "Tanghulu", name_target: "冰糖葫芦", price: "¥10", description_target: "老北京冰糖葫芦串，酸甜酥脆" }
          ]
        }
      ]
    }
  },
  korean: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "음료",
          items: [
            { name: "Americano", name_target: "아메리카노", price: "₩4,500", description_target: "진한 아메리카노" },
            { name: "Latte", name_target: "카페라떼", price: "₩5,000", description_target: "따뜻한 카페라떼" },
            { name: "Citron Tea", name_target: "유자차", price: "₩4,500", description_target: "달콤한 유자차" }
          ]
        },
        {
          name: "Snacks",
          name_target: "간식",
          items: [
            { name: "Sweet Pancake", name_target: "호떡", price: "₩2,000", description_target: "달콤한 호떡" },
            { name: "Rice Cake", name_target: "떡", price: "₩3,000", description_target: "쫄깃한 떡" },
            { name: "Kimbap", name_target: "김밥", price: "₩3,500", description_target: "야채 김밥 한 줄" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Coffee",
          name_target: "커피",
          items: [
            { name: "Americano", name_target: "아메리카노", price: "₩4,500", description_target: "에스프레소에 뜨거운 물을 넣은 커피" },
            { name: "Café Latte", name_target: "카페라떼", price: "₩5,500", description_target: "에스프레소에 스팀 밀크를 넣은 라떼" },
            { name: "Dalgona Coffee", name_target: "달고나 커피", price: "₩6,000", description_target: "달고나 크림을 올린 한국식 커피" },
            { name: "Misugaru Latte", name_target: "미숫가루 라떼", price: "₩5,500", description_target: "한국 전통 곡물 가루 라떼" }
          ]
        },
        {
          name: "Tea & Other Drinks",
          name_target: "차 & 음료",
          items: [
            { name: "Citron Tea", name_target: "유자차", price: "₩5,000", description_target: "유자청으로 만든 향긋한 차" },
            { name: "Barley Tea", name_target: "보리차", price: "₩3,500", description_target: "구수한 볶은 보리차" },
            { name: "Banana Milk", name_target: "바나나우유", price: "₩3,000", description_target: "달콤한 바나나맛 우유" }
          ]
        },
        {
          name: "Snacks & Street Food",
          name_target: "간식 & 분식",
          items: [
            { name: "Sweet Pancake", name_target: "호떡", price: "₩2,500", description_target: "흑설탕과 견과류를 넣은 호떡" },
            { name: "Kimbap", name_target: "참치 김밥", price: "₩4,000", description_target: "참치와 야채를 넣은 김밥 한 줄" },
            { name: "Rice Cake Skewers", name_target: "떡꼬치", price: "₩2,000", description_target: "달콤한 양념을 바른 떡꼬치" },
            { name: "Toast", name_target: "길거리 토스트", price: "₩3,500", description_target: "계란과 햄을 넣은 한국식 토스트" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Coffee Specialties",
          name_target: "스페셜티 커피",
          items: [
            { name: "Hand Drip Coffee", name_target: "핸드드립 커피", price: "₩6,500", description_target: "원두를 직접 갈아 정성껏 내린 핸드드립 커피" },
            { name: "Dalgona Coffee", name_target: "달고나 커피", price: "₩6,500", description_target: "수제 달고나 크림을 올린 한국 고유의 휘핑 커피" },
            { name: "Einspanner", name_target: "아인슈페너", price: "₩7,000", description_target: "진한 에스프레소 위에 수제 생크림을 올린 비엔나 커피" },
            { name: "Sweet Potato Latte", name_target: "고구마 라떼", price: "₩6,000", description_target: "국산 고구마를 사용한 달콤하고 고소한 라떼" }
          ]
        },
        {
          name: "Traditional Korean Drinks",
          name_target: "전통 음료",
          items: [
            { name: "Sikhye", name_target: "식혜", price: "₩4,500", description_target: "엿기름으로 발효시킨 전통 쌀 음료, 밥알이 동동" },
            { name: "Sujeonggwa", name_target: "수정과", price: "₩4,500", description_target: "계피와 생강으로 우려낸 전통 음료에 곶감 띄움" },
            { name: "Omija Tea", name_target: "오미자차", price: "₩5,500", description_target: "다섯 가지 맛을 가진 오미자 열매로 우린 차" },
            { name: "Misugaru Latte", name_target: "미숫가루 라떼", price: "₩5,500", description_target: "여러 곡물을 볶아 갈아 만든 한국 전통 선식 음료" }
          ]
        },
        {
          name: "Korean Snacks",
          name_target: "한국 간식",
          items: [
            { name: "Hotteok", name_target: "씨앗 호떡", price: "₩3,000", description_target: "해바라기씨와 흑설탕을 넣은 바삭한 수제 호떡" },
            { name: "Tteokbokki", name_target: "떡볶이", price: "₩5,000", description_target: "쫄깃한 가래떡을 매콤달콤한 고추장 양념에 볶은 분식" },
            { name: "Gimbap", name_target: "충무 김밥", price: "₩5,500", description_target: "통영 충무 스타일의 꼬들꼬들한 김밥에 무김치 곁들임" },
            { name: "Bungeoppang", name_target: "붕어빵", price: "₩2,000", description_target: "팥앙금을 가득 넣은 바삭한 붕어 모양 빵" },
            { name: "Gyeranppang", name_target: "계란빵", price: "₩2,500", description_target: "달콤한 빵 위에 통계란을 올려 구운 길거리 간식" }
          ]
        },
        {
          name: "Traditional Sweets",
          name_target: "전통 디저트",
          items: [
            { name: "Patbingsu", name_target: "팥빙수", price: "₩9,000", description_target: "곱게 간 얼음 위에 단팥, 떡, 연유를 올린 한국 전통 빙수" },
            { name: "Yakgwa", name_target: "약과", price: "₩3,500", description_target: "참기름과 꿀로 만든 전통 한과, 바삭하고 달콤" },
            { name: "Songpyeon", name_target: "송편", price: "₩4,000", description_target: "솔잎 향이 나는 반달 모양 떡에 깨와 꿀 소 넣음" },
            { name: "Injeolmi", name_target: "인절미", price: "₩3,500", description_target: "찹쌀을 쪄서 찧은 떡에 고소한 콩가루를 묻힌 전통 떡" }
          ]
        }
      ]
    }
  },
  arabic: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "مشروبات",
          items: [
            { name: "Arabic Coffee", name_target: "قهوة عربية", price: "د.إ 15", description_target: "قهوة عربية تقليدية بالهيل" },
            { name: "Tea", name_target: "شاي", price: "د.إ 10", description_target: "شاي أحمر ساخن" },
            { name: "Fresh Juice", name_target: "عصير طازج", price: "د.إ 18", description_target: "عصير برتقال طازج" }
          ]
        },
        {
          name: "Snacks",
          name_target: "مأكولات خفيفة",
          items: [
            { name: "Falafel", name_target: "فلافل", price: "د.إ 12", description_target: "كرات فلافل مقلية" },
            { name: "Hummus", name_target: "حمص", price: "د.إ 15", description_target: "حمص بالطحينة" },
            { name: "Flatbread", name_target: "خبز عربي", price: "د.إ 5", description_target: "خبز عربي طازج" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "مشروبات ساخنة",
          items: [
            { name: "Arabic Coffee", name_target: "قهوة عربية", price: "د.إ 15", description_target: "قهوة عربية مع الهيل والزعفران" },
            { name: "Turkish Coffee", name_target: "قهوة تركية", price: "د.إ 18", description_target: "قهوة تركية مطحونة ناعمة" },
            { name: "Karak Tea", name_target: "شاي كرك", price: "د.إ 12", description_target: "شاي بالحليب والتوابل" },
            { name: "Sahlab", name_target: "سحلب", price: "د.إ 20", description_target: "مشروب سحلب ساخن بالقرفة والمكسرات" }
          ]
        },
        {
          name: "Cold Drinks",
          name_target: "مشروبات باردة",
          items: [
            { name: "Lemon Mint", name_target: "ليمون بالنعناع", price: "د.إ 15", description_target: "عصير ليمون طازج بالنعناع المثلج" },
            { name: "Tamarind Juice", name_target: "عصير تمر هندي", price: "د.إ 15", description_target: "عصير تمر هندي بارد منعش" },
            { name: "Avocado Smoothie", name_target: "عصير أفوكادو", price: "د.إ 22", description_target: "أفوكادو مخفوق بالحليب والعسل" }
          ]
        },
        {
          name: "Food",
          name_target: "أطعمة",
          items: [
            { name: "Falafel Plate", name_target: "صحن فلافل", price: "د.إ 25", description_target: "فلافل مع حمص وسلطة وخبز" },
            { name: "Manakeesh", name_target: "مناقيش", price: "د.إ 15", description_target: "مناقيش بالزعتر والجبنة" },
            { name: "Shawarma", name_target: "شاورما", price: "د.إ 20", description_target: "شاورما دجاج في خبز عربي" },
            { name: "Fattoush", name_target: "فتوش", price: "د.إ 18", description_target: "سلطة فتوش بالخبز المحمص" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Traditional Coffee & Tea",
          name_target: "القهوة والشاي التقليدي",
          items: [
            { name: "Saudi Arabic Coffee", name_target: "قهوة عربية سعودية", price: "د.إ 20", description_target: "قهوة عربية أصيلة محمصة بخفة مع الهيل والزعفران وماء الورد" },
            { name: "Turkish Coffee", name_target: "قهوة تركية على الجمر", price: "د.إ 22", description_target: "قهوة تركية مطحونة يدوياً ومحضرة على الجمر بالطريقة الأصلية" },
            { name: "Karak Tea", name_target: "شاي كرك خاص", price: "د.إ 15", description_target: "شاي أسود مغلي بالحليب الطازج والهيل والزعفران" },
            { name: "Moroccan Mint Tea", name_target: "شاي مغربي بالنعناع", price: "د.إ 18", description_target: "شاي أخضر مع النعناع الطازج محلى بالسكر على الطريقة المغربية" }
          ]
        },
        {
          name: "Cold Beverages",
          name_target: "مشروبات باردة ومنعشة",
          items: [
            { name: "Jallab", name_target: "جلاب", price: "د.إ 18", description_target: "شراب الجلاب بالزبيب والصنوبر وماء الورد المثلج" },
            { name: "Qamar al-Din", name_target: "قمر الدين", price: "د.إ 15", description_target: "مشروب المشمش المجفف التقليدي المنعش" },
            { name: "Lemon Mint", name_target: "ليمون بالنعناع", price: "د.إ 15", description_target: "عصير ليمون طازج بأوراق النعناع المهروسة والثلج المجروش" },
            { name: "Tamarind Juice", name_target: "عصير تمر هندي", price: "د.إ 15", description_target: "تمر هندي منقوع ومصفى مع السكر والماء البارد" },
            { name: "Ayran", name_target: "عيران", price: "د.إ 12", description_target: "لبن مخيض بارد مملح على الطريقة الشامية" }
          ]
        },
        {
          name: "Savory Dishes",
          name_target: "أطباق مالحة",
          items: [
            { name: "Falafel Plate", name_target: "صحن فلافل كامل", price: "د.إ 30", description_target: "فلافل مقرمشة من الحمص مع حمص بالطحينة وسلطة وخبز طازج ومخللات" },
            { name: "Manakeesh", name_target: "مناقيش بالزعتر", price: "د.إ 18", description_target: "عجينة مخبوزة بزعتر بلدي وزيت زيتون فلسطيني" },
            { name: "Ful Medames", name_target: "فول مدمس", price: "د.إ 20", description_target: "فول مصري مدمس بالثوم والليمون وزيت الزيتون والكمون" },
            { name: "Labneh Plate", name_target: "صحن لبنة", price: "د.إ 22", description_target: "لبنة كريمية بزيت الزيتون والنعناع مع خبز محمص" },
            { name: "Shakshuka", name_target: "شكشوكة", price: "د.إ 28", description_target: "بيض مسلوق في صلصة طماطم متبلة بالكمون والفلفل الحار" }
          ]
        },
        {
          name: "Sweets & Pastries",
          name_target: "حلويات ومعجنات",
          items: [
            { name: "Kunafa", name_target: "كنافة نابلسية", price: "د.إ 25", description_target: "كنافة بالجبنة النابلسية مع القطر وماء الزهر" },
            { name: "Baklava", name_target: "بقلاوة", price: "د.إ 20", description_target: "طبقات رقيقة من العجين المحشو بالفستق الحلبي والقطر" },
            { name: "Luqaimat", name_target: "لقيمات", price: "د.إ 15", description_target: "كرات عجين مقلية ذهبية مغطاة بدبس التمر والسمسم" },
            { name: "Date Maamoul", name_target: "معمول بالتمر", price: "د.إ 18", description_target: "كعك محشو بعجينة التمر المعطرة بماء الورد والهيل" }
          ]
        }
      ]
    }
  },
  russian: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "Напитки",
          items: [
            { name: "Coffee with Milk", name_target: "Кофе с молоком", price: "₽250", description_target: "Горячий кофе с молоком" },
            { name: "Black Tea", name_target: "Чёрный чай", price: "₽150", description_target: "Горячий чёрный чай" },
            { name: "Hot Chocolate", name_target: "Горячий шоколад", price: "₽280", description_target: "Горячий шоколад со сливками" }
          ]
        },
        {
          name: "Pastries",
          name_target: "Выпечка",
          items: [
            { name: "Blini", name_target: "Блины", price: "₽200", description_target: "Тонкие блины со сметаной" },
            { name: "Syrniki", name_target: "Сырники", price: "₽250", description_target: "Творожные оладьи" },
            { name: "Pirozhki", name_target: "Пирожки", price: "₽100", description_target: "Пирожки с мясом" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Горячие напитки",
          items: [
            { name: "Americano", name_target: "Американо", price: "₽200", description_target: "Чёрный кофе на основе эспрессо" },
            { name: "Cappuccino", name_target: "Капучино", price: "₽280", description_target: "Кофе с молочной пенкой" },
            { name: "Tea with Jam", name_target: "Чай с вареньем", price: "₽180", description_target: "Чёрный чай с домашним вареньем" },
            { name: "Sbiten", name_target: "Сбитень", price: "₽220", description_target: "Горячий медовый напиток с пряностями" }
          ]
        },
        {
          name: "Cold Drinks",
          name_target: "Холодные напитки",
          items: [
            { name: "Kompot", name_target: "Компот", price: "₽150", description_target: "Традиционный ягодный компот" },
            { name: "Mors", name_target: "Морс", price: "₽170", description_target: "Клюквенный морс из свежих ягод" },
            { name: "Kvas", name_target: "Квас", price: "₽120", description_target: "Хлебный квас домашнего приготовления" }
          ]
        },
        {
          name: "Food & Pastries",
          name_target: "Еда и выпечка",
          items: [
            { name: "Blini with Sour Cream", name_target: "Блины со сметаной", price: "₽250", description_target: "Тонкие блины с деревенской сметаной" },
            { name: "Syrniki", name_target: "Сырники с вареньем", price: "₽280", description_target: "Творожные оладьи с ягодным вареньем" },
            { name: "Pirozhki", name_target: "Пирожки с капустой", price: "₽120", description_target: "Жареные пирожки с капустой и яйцом" },
            { name: "Porridge", name_target: "Каша овсяная", price: "₽180", description_target: "Овсяная каша с ягодами и мёдом" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Coffee & Tea",
          name_target: "Кофе и чай",
          items: [
            { name: "Filter Coffee", name_target: "Фильтр-кофе", price: "₽250", description_target: "Кофе из свежеобжаренных зёрен, заваренный через фильтр" },
            { name: "Raf Coffee", name_target: "Раф-кофе", price: "₽350", description_target: "Авторский напиток из эспрессо, сливок и ванильного сахара" },
            { name: "Ivan-chai", name_target: "Иван-чай", price: "₽200", description_target: "Ферментированный кипрейный чай из экологически чистых регионов" },
            { name: "Tea with Lemon", name_target: "Чай с лимоном", price: "₽180", description_target: "Чёрный чай со свежим лимоном и мёдом по-русски" },
            { name: "Sea Buckthorn Tea", name_target: "Облепиховый чай", price: "₽250", description_target: "Горячий чай из свежей облепихи с мёдом и имбирём" }
          ]
        },
        {
          name: "Traditional Drinks",
          name_target: "Традиционные напитки",
          items: [
            { name: "Sbiten", name_target: "Сбитень медовый", price: "₽250", description_target: "Старинный русский горячий напиток из мёда с корицей и гвоздикой" },
            { name: "Kvas", name_target: "Квас хлебный", price: "₽150", description_target: "Домашний квас из ржаного хлеба с изюмом" },
            { name: "Mors", name_target: "Клюквенный морс", price: "₽180", description_target: "Морс из свежей клюквы с мёдом по старинному рецепту" },
            { name: "Kompot", name_target: "Компот из сухофруктов", price: "₽150", description_target: "Узвар из яблок, груш, чернослива и кураги" }
          ]
        },
        {
          name: "Breakfast & Savory",
          name_target: "Завтраки и закуски",
          items: [
            { name: "Blini with Caviar", name_target: "Блины с икрой", price: "₽600", description_target: "Тонкие гречневые блины с красной икрой и сметаной" },
            { name: "Syrniki", name_target: "Сырники домашние", price: "₽320", description_target: "Творожные сырники из фермерского творога с вареньем и сметаной" },
            { name: "Buckwheat Porridge", name_target: "Гречневая каша", price: "₽220", description_target: "Рассыпчатая гречневая каша с маслом и зеленью" },
            { name: "Pirozhki", name_target: "Пирожки домашние", price: "₽150", description_target: "Пирожки с начинкой на выбор: мясо, капуста или картофель" },
            { name: "Draniki", name_target: "Драники", price: "₽280", description_target: "Картофельные оладьи со сметаной и укропом" }
          ]
        },
        {
          name: "Sweets",
          name_target: "Сладости",
          items: [
            { name: "Honey Cake", name_target: "Медовик", price: "₽350", description_target: "Многослойный медовый торт с нежным сметанным кремом" },
            { name: "Bird's Milk Cake", name_target: "Птичье молоко", price: "₽380", description_target: "Воздушное суфле в шоколадной глазури — легендарный советский десерт" },
            { name: "Pryanik", name_target: "Тульский пряник", price: "₽200", description_target: "Печатный пряник с начинкой из варёной сгущёнки" },
            { name: "Vatrushka", name_target: "Ватрушка", price: "₽180", description_target: "Сдобная булочка с творожной начинкой и изюмом" }
          ]
        }
      ]
    }
  }
};

export const groceryStoreMenus: Record<string, Record<string, MenuSections>> = {
  spanish: {
    beginner: {
      sections: [
        {
          name: "Fruits",
          name_target: "Frutas",
          items: [
            { name: "Oranges", name_target: "Naranjas", price: "€2,00/kg", description_target: "Naranjas frescas" },
            { name: "Apples", name_target: "Manzanas", price: "€2,50/kg", description_target: "Manzanas rojas" },
            { name: "Bananas", name_target: "Plátanos", price: "€1,80/kg", description_target: "Plátanos de Canarias" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Verduras",
          items: [
            { name: "Tomatoes", name_target: "Tomates", price: "€2,50/kg", description_target: "Tomates maduros" },
            { name: "Onions", name_target: "Cebollas", price: "€1,50/kg", description_target: "Cebollas frescas" },
            { name: "Peppers", name_target: "Pimientos", price: "€3,00/kg", description_target: "Pimientos rojos" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Fruits",
          name_target: "Frutas",
          items: [
            { name: "Oranges", name_target: "Naranjas valencianas", price: "€2,00/kg", description_target: "Naranjas de Valencia, dulces y jugosas" },
            { name: "Strawberries", name_target: "Fresas", price: "€4,50/kg", description_target: "Fresas de Huelva de temporada" },
            { name: "Grapes", name_target: "Uvas", price: "€3,00/kg", description_target: "Uvas blancas sin pepitas" },
            { name: "Peaches", name_target: "Melocotones", price: "€3,50/kg", description_target: "Melocotones de Calanda maduros" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Verduras",
          items: [
            { name: "Tomatoes", name_target: "Tomates de la huerta", price: "€2,80/kg", description_target: "Tomates de la huerta murciana" },
            { name: "Peppers", name_target: "Pimientos del piquillo", price: "€5,00/kg", description_target: "Pimientos rojos asados de Navarra" },
            { name: "Zucchini", name_target: "Calabacines", price: "€2,00/kg", description_target: "Calabacines frescos de invernadero" }
          ]
        },
        {
          name: "Deli",
          name_target: "Charcutería",
          items: [
            { name: "Iberian Ham", name_target: "Jamón ibérico", price: "€18,00/kg", description_target: "Jamón ibérico curado de bellota" },
            { name: "Manchego Cheese", name_target: "Queso manchego", price: "€14,00/kg", description_target: "Queso curado de oveja manchega" },
            { name: "Chorizo", name_target: "Chorizo ibérico", price: "€12,00/kg", description_target: "Chorizo curado con pimentón de la Vera" },
            { name: "Olives", name_target: "Aceitunas", price: "€6,00/kg", description_target: "Aceitunas manzanilla aliñadas" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Seasonal Fruits",
          name_target: "Frutas de Temporada",
          items: [
            { name: "Valencia Oranges", name_target: "Naranjas de Valencia", price: "€2,20/kg", description_target: "Naranjas navel de denominación de origen con certificado ecológico" },
            { name: "Huelva Strawberries", name_target: "Fresas de Huelva", price: "€5,00/kg", description_target: "Fresas recién recolectadas de los campos de Huelva" },
            { name: "Calanda Peaches", name_target: "Melocotones de Calanda", price: "€4,50/kg", description_target: "Melocotones tardíos con denominación de origen protegida" },
            { name: "Persimmons", name_target: "Caquis de la Ribera", price: "€3,80/kg", description_target: "Kaki persimon de la Ribera del Xúquer, dulce y firme" }
          ]
        },
        {
          name: "Market Vegetables",
          name_target: "Verduras del Mercado",
          items: [
            { name: "Huerta Tomatoes", name_target: "Tomates raf", price: "€5,00/kg", description_target: "Tomates raf de Almería con sabor intenso y textura carnosa" },
            { name: "Piquillo Peppers", name_target: "Pimientos del piquillo", price: "€6,00/kg", description_target: "Pimientos del piquillo de Lodosa asados a la leña" },
            { name: "Artichokes", name_target: "Alcachofas", price: "€4,00/kg", description_target: "Alcachofas de la Vega Baja, tiernas y de temporada" },
            { name: "Padrón Peppers", name_target: "Pimientos de Padrón", price: "€5,50/kg", description_target: "Pimientos gallegos pequeños, unos pican y otros no" },
            { name: "Garlic", name_target: "Ajos morados", price: "€8,00/kg", description_target: "Ajo morado de Las Pedroñeras con indicación geográfica protegida" }
          ]
        },
        {
          name: "Cured Meats & Cheese",
          name_target: "Embutidos y Quesos",
          items: [
            { name: "Iberian Acorn Ham", name_target: "Jamón ibérico de bellota", price: "€45,00/kg", description_target: "Jamón de cerdo ibérico puro alimentado con bellota, curación mínima de 36 meses" },
            { name: "Aged Manchego", name_target: "Queso manchego curado", price: "€16,00/kg", description_target: "Queso de oveja manchega con curación de 12 meses, sabor intenso" },
            { name: "Iberian Chorizo", name_target: "Chorizo ibérico de bellota", price: "€15,00/kg", description_target: "Chorizo de cerdo ibérico con pimentón de la Vera ahumado" },
            { name: "Cecina", name_target: "Cecina de León", price: "€22,00/kg", description_target: "Carne de vacuno curada y ahumada con roble, indicación geográfica protegida" }
          ]
        },
        {
          name: "Pantry Staples",
          name_target: "Despensa",
          items: [
            { name: "Extra Virgin Olive Oil", name_target: "Aceite de oliva virgen extra", price: "€8,00/L", description_target: "Aceite de primera prensada en frío de olivas picual de Jaén" },
            { name: "Saffron", name_target: "Azafrán de La Mancha", price: "€6,00/g", description_target: "Azafrán con denominación de origen, hebras seleccionadas a mano" },
            { name: "Bomba Rice", name_target: "Arroz bomba", price: "€4,50/kg", description_target: "Arroz bomba de la Albufera para paella tradicional" },
            { name: "Smoked Paprika", name_target: "Pimentón de la Vera", price: "€5,00/lata", description_target: "Pimentón ahumado con denominación de origen, dulce o picante" }
          ]
        }
      ]
    }
  },
  french: {
    beginner: {
      sections: [
        {
          name: "Fruits",
          name_target: "Fruits",
          items: [
            { name: "Apples", name_target: "Pommes", price: "€2,50/kg", description_target: "Pommes rouges fraîches" },
            { name: "Pears", name_target: "Poires", price: "€3,00/kg", description_target: "Poires mûres" },
            { name: "Oranges", name_target: "Oranges", price: "€2,80/kg", description_target: "Oranges juteuses" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Légumes",
          items: [
            { name: "Potatoes", name_target: "Pommes de terre", price: "€1,50/kg", description_target: "Pommes de terre fraîches" },
            { name: "Carrots", name_target: "Carottes", price: "€1,80/kg", description_target: "Carottes du marché" },
            { name: "Lettuce", name_target: "Laitue", price: "€1,20/pièce", description_target: "Salade verte fraîche" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Fruits",
          name_target: "Fruits",
          items: [
            { name: "Apples", name_target: "Pommes Golden", price: "€2,80/kg", description_target: "Pommes Golden du Val de Loire" },
            { name: "Cherries", name_target: "Cerises", price: "€8,00/kg", description_target: "Cerises de Provence de saison" },
            { name: "Mirabelle Plums", name_target: "Mirabelles", price: "€6,00/kg", description_target: "Mirabelles de Lorraine sucrées" },
            { name: "Grapes", name_target: "Raisins", price: "€4,50/kg", description_target: "Raisins blancs du Midi" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Légumes",
          items: [
            { name: "Tomatoes", name_target: "Tomates", price: "€3,50/kg", description_target: "Tomates cœur de bœuf de pleine terre" },
            { name: "Green Beans", name_target: "Haricots verts", price: "€5,00/kg", description_target: "Haricots verts fins et frais" },
            { name: "Leeks", name_target: "Poireaux", price: "€2,50/kg", description_target: "Poireaux de saison" }
          ]
        },
        {
          name: "Cheese & Deli",
          name_target: "Fromagerie et Charcuterie",
          items: [
            { name: "Camembert", name_target: "Camembert de Normandie", price: "€4,50/pièce", description_target: "Camembert au lait cru AOP" },
            { name: "Comté", name_target: "Comté", price: "€18,00/kg", description_target: "Comté affiné 12 mois du Jura" },
            { name: "Saucisson", name_target: "Saucisson sec", price: "€15,00/kg", description_target: "Saucisson artisanal au poivre" },
            { name: "Pâté", name_target: "Pâté de campagne", price: "€12,00/kg", description_target: "Pâté de campagne artisanal" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Seasonal Fruits",
          name_target: "Fruits de Saison",
          items: [
            { name: "Mirabelle Plums", name_target: "Mirabelles de Lorraine", price: "€7,00/kg", description_target: "Mirabelles dorées à maturité parfaite, cueillies à la main" },
            { name: "Charentais Melon", name_target: "Melon charentais", price: "€3,50/pièce", description_target: "Melon charentais IGP à chair orange parfumée" },
            { name: "Gariguette Strawberries", name_target: "Fraises gariguette", price: "€9,00/kg", description_target: "Fraises gariguette du Périgord, sucrées et acidulées" },
            { name: "Reinette Apples", name_target: "Pommes reinette", price: "€3,50/kg", description_target: "Pommes reinette du Mans idéales pour la tarte tatin" }
          ]
        },
        {
          name: "Market Vegetables",
          name_target: "Légumes du Marché",
          items: [
            { name: "Heirloom Tomatoes", name_target: "Tomates anciennes", price: "€5,50/kg", description_target: "Mélange de tomates anciennes de plein champ aux saveurs intenses" },
            { name: "Asparagus", name_target: "Asperges blanches", price: "€12,00/kg", description_target: "Asperges blanches des Landes, tendres et délicates" },
            { name: "Shallots", name_target: "Échalotes de Bretagne", price: "€5,00/kg", description_target: "Échalotes traditionnelles de Bretagne, arôme délicat" },
            { name: "Cèpes", name_target: "Cèpes de Bordeaux", price: "€35,00/kg", description_target: "Cèpes frais cueillis en forêt, saveur boisée et intense" },
            { name: "Artichokes", name_target: "Artichauts de Bretagne", price: "€2,50/pièce", description_target: "Gros artichauts camus de Bretagne à cœur tendre" }
          ]
        },
        {
          name: "Cheese Selection",
          name_target: "Plateau de Fromages",
          items: [
            { name: "Camembert", name_target: "Camembert de Normandie AOP", price: "€5,50/pièce", description_target: "Camembert au lait cru moulé à la louche, affiné en cave" },
            { name: "Aged Comté", name_target: "Comté 24 mois", price: "€25,00/kg", description_target: "Comté AOP affiné 24 mois au fort Marcel, notes de noisette" },
            { name: "Roquefort", name_target: "Roquefort Société", price: "€22,00/kg", description_target: "Roquefort AOP au lait cru de brebis, affiné en caves naturelles" },
            { name: "Reblochon", name_target: "Reblochon de Savoie", price: "€16,00/kg", description_target: "Fromage savoyard au lait cru AOP, onctueux et crémeux" }
          ]
        },
        {
          name: "Charcuterie & Pantry",
          name_target: "Charcuterie et Épicerie",
          items: [
            { name: "Duck Confit", name_target: "Confit de canard", price: "€12,00/pièce", description_target: "Cuisses de canard confites du Sud-Ouest en bocal artisanal" },
            { name: "Saucisson", name_target: "Saucisson sec d'Auvergne", price: "€18,00/kg", description_target: "Saucisson pur porc fermier IGP, séché naturellement" },
            { name: "Dijon Mustard", name_target: "Moutarde de Dijon", price: "€3,50/pot", description_target: "Moutarde de Dijon à l'ancienne en grains, fabrication traditionnelle" },
            { name: "Fleur de Sel", name_target: "Fleur de sel de Guérande", price: "€8,00/250g", description_target: "Fleur de sel récoltée à la main dans les marais salants de Guérande" }
          ]
        }
      ]
    }
  },
  german: {
    beginner: {
      sections: [
        {
          name: "Fruits",
          name_target: "Obst",
          items: [
            { name: "Apples", name_target: "Äpfel", price: "€2,00/kg", description_target: "Frische rote Äpfel" },
            { name: "Bananas", name_target: "Bananen", price: "€1,50/kg", description_target: "Reife Bananen" },
            { name: "Grapes", name_target: "Trauben", price: "€3,50/kg", description_target: "Weiße Trauben" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Gemüse",
          items: [
            { name: "Potatoes", name_target: "Kartoffeln", price: "€1,50/kg", description_target: "Festkochende Kartoffeln" },
            { name: "Carrots", name_target: "Karotten", price: "€1,80/kg", description_target: "Frische Karotten" },
            { name: "Cucumbers", name_target: "Gurken", price: "€0,80/Stück", description_target: "Salatgurke" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Fruits",
          name_target: "Obst",
          items: [
            { name: "Apples", name_target: "Äpfel Elstar", price: "€2,50/kg", description_target: "Elstar Äpfel aus dem Alten Land" },
            { name: "Plums", name_target: "Zwetschgen", price: "€3,50/kg", description_target: "Süße Zwetschgen aus Baden" },
            { name: "Cherries", name_target: "Kirschen", price: "€6,00/kg", description_target: "Süßkirschen aus der Region" },
            { name: "Strawberries", name_target: "Erdbeeren", price: "€5,00/500g", description_target: "Deutsche Erdbeeren vom Feld" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Gemüse",
          items: [
            { name: "Asparagus", name_target: "Spargel", price: "€8,00/kg", description_target: "Weißer Spargel aus Niedersachsen" },
            { name: "Kohlrabi", name_target: "Kohlrabi", price: "€1,50/Stück", description_target: "Zarter Kohlrabi aus der Region" },
            { name: "Red Cabbage", name_target: "Rotkohl", price: "€1,80/Stück", description_target: "Frischer Rotkohl vom Markt" }
          ]
        },
        {
          name: "Dairy & Deli",
          name_target: "Molkerei und Feinkost",
          items: [
            { name: "Emmentaler", name_target: "Allgäuer Emmentaler", price: "€10,00/kg", description_target: "Bergkäse aus dem Allgäu" },
            { name: "Black Forest Ham", name_target: "Schwarzwälder Schinken", price: "€18,00/kg", description_target: "Geräucherter Schinken aus dem Schwarzwald" },
            { name: "Bratwurst", name_target: "Nürnberger Bratwürstchen", price: "€8,00/6 Stück", description_target: "Original Nürnberger Rostbratwürstchen" },
            { name: "Sauerkraut", name_target: "Sauerkraut", price: "€2,50/kg", description_target: "Frisches Sauerkraut aus dem Fass" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Seasonal Fruits",
          name_target: "Saisonales Obst",
          items: [
            { name: "Alte Land Apples", name_target: "Elstar Äpfel", price: "€3,00/kg", description_target: "Knackige Elstar Äpfel aus dem Alten Land bei Hamburg" },
            { name: "Baden Plums", name_target: "Bühler Zwetschgen", price: "€4,00/kg", description_target: "Saftige Bühlerzwetschgen mit Honigaroma" },
            { name: "Lake Constance Pears", name_target: "Bodensee-Birnen", price: "€3,50/kg", description_target: "Williams-Christ-Birnen vom Bodensee, vollreif geerntet" },
            { name: "Quince", name_target: "Quitten", price: "€4,50/kg", description_target: "Duftende Quitten aus fränkischem Anbau" }
          ]
        },
        {
          name: "Market Vegetables",
          name_target: "Marktgemüse",
          items: [
            { name: "White Asparagus", name_target: "Beelitzer Spargel", price: "€12,00/kg", description_target: "Frisch gestochener Spargel aus Beelitz, Klasse Extra" },
            { name: "Kohlrabi", name_target: "Kohlrabi", price: "€1,80/Stück", description_target: "Junger zarter Kohlrabi aus regionalem Bioanbau" },
            { name: "Chanterelles", name_target: "Pfifferlinge", price: "€25,00/kg", description_target: "Frische Pfifferlinge aus bayerischen Wäldern" },
            { name: "Pumpkin", name_target: "Hokkaido-Kürbis", price: "€2,50/Stück", description_target: "Aromatischer Hokkaidokürbis aus ökologischem Anbau" },
            { name: "Horseradish", name_target: "Meerrettich", price: "€6,00/kg", description_target: "Fränkischer Meerrettich, frisch gerieben scharf und würzig" }
          ]
        },
        {
          name: "Cheese & Charcuterie",
          name_target: "Käse und Wurst",
          items: [
            { name: "Allgäu Emmentaler", name_target: "Allgäuer Bergkäse", price: "€14,00/kg", description_target: "Würziger Bergkäse aus Heumilch, 12 Monate gereift" },
            { name: "Tilsiter", name_target: "Holsteiner Tilsiter", price: "€10,00/kg", description_target: "Halbfester Schnittkäse mit aromatischem Geschmack" },
            { name: "Schwarzwald Ham", name_target: "Schwarzwälder Schinken", price: "€22,00/kg", description_target: "Über Tannenholz geräucherter Schinken mit geschützter Herkunft" },
            { name: "Leberwurst", name_target: "Hausmacher Leberwurst", price: "€8,00/250g", description_target: "Grobe Leberwurst nach traditionellem Metzgerrezept" }
          ]
        },
        {
          name: "Bakery & Staples",
          name_target: "Bäckerei und Grundnahrungsmittel",
          items: [
            { name: "Sourdough Bread", name_target: "Sauerteigbrot", price: "€4,50/Laib", description_target: "Roggen-Sauerteigbrot aus der Holzofenbäckerei" },
            { name: "Lye Rolls", name_target: "Laugenstangen", price: "€1,20/Stück", description_target: "Knusprige Laugenstangen frisch aus dem Ofen" },
            { name: "Spätzle", name_target: "Schwäbische Spätzle", price: "€3,50/500g", description_target: "Handgeschabte Eierspätzle aus schwäbischer Produktion" },
            { name: "Senf", name_target: "Düsseldorfer Senf", price: "€2,80/Glas", description_target: "Scharfer Düsseldorfer Löwensenf im traditionellen Steintopf" }
          ]
        }
      ]
    }
  },
  italian: {
    beginner: {
      sections: [
        {
          name: "Fruits",
          name_target: "Frutta",
          items: [
            { name: "Oranges", name_target: "Arance", price: "€2,00/kg", description_target: "Arance fresche" },
            { name: "Lemons", name_target: "Limoni", price: "€2,50/kg", description_target: "Limoni gialli" },
            { name: "Apples", name_target: "Mele", price: "€2,20/kg", description_target: "Mele rosse" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Verdura",
          items: [
            { name: "Tomatoes", name_target: "Pomodori", price: "€2,50/kg", description_target: "Pomodori maturi" },
            { name: "Zucchini", name_target: "Zucchine", price: "€2,00/kg", description_target: "Zucchine fresche" },
            { name: "Eggplant", name_target: "Melanzane", price: "€2,80/kg", description_target: "Melanzane viola" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Fruits",
          name_target: "Frutta",
          items: [
            { name: "Blood Oranges", name_target: "Arance rosse", price: "€2,50/kg", description_target: "Arance rosse di Sicilia" },
            { name: "Amalfi Lemons", name_target: "Limoni di Amalfi", price: "€4,00/kg", description_target: "Limoni costieri profumati" },
            { name: "Figs", name_target: "Fichi", price: "€6,00/kg", description_target: "Fichi freschi di stagione" },
            { name: "Grapes", name_target: "Uva da tavola", price: "€3,50/kg", description_target: "Uva bianca pugliese senza semi" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Verdura",
          items: [
            { name: "San Marzano Tomatoes", name_target: "Pomodori San Marzano", price: "€3,50/kg", description_target: "Pomodori San Marzano DOP" },
            { name: "Artichokes", name_target: "Carciofi romaneschi", price: "€2,00/pezzo", description_target: "Carciofi mammole romani" },
            { name: "Basil", name_target: "Basilico", price: "€1,50/mazzo", description_target: "Basilico genovese profumato" }
          ]
        },
        {
          name: "Cheese & Deli",
          name_target: "Formaggi e Salumi",
          items: [
            { name: "Parmigiano Reggiano", name_target: "Parmigiano Reggiano", price: "€20,00/kg", description_target: "Parmigiano stagionato 24 mesi DOP" },
            { name: "Mozzarella", name_target: "Mozzarella di bufala", price: "€12,00/kg", description_target: "Mozzarella di bufala campana DOP" },
            { name: "Prosciutto", name_target: "Prosciutto di Parma", price: "€25,00/kg", description_target: "Prosciutto crudo stagionato 18 mesi" },
            { name: "Mortadella", name_target: "Mortadella di Bologna", price: "€10,00/kg", description_target: "Mortadella IGP con pistacchi" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Seasonal Fruits",
          name_target: "Frutta di Stagione",
          items: [
            { name: "Sicilian Blood Oranges", name_target: "Arance rosse di Sicilia", price: "€3,00/kg", description_target: "Arance tarocco IGP dalla piana di Catania, dolci e succose" },
            { name: "Amalfi Lemons", name_target: "Limoni Costa d'Amalfi", price: "€5,00/kg", description_target: "Sfusato amalfitano IGP dalla Costiera, profumato e succoso" },
            { name: "Piedmont Peaches", name_target: "Pesche piemontesi", price: "€4,50/kg", description_target: "Pesche a pasta gialla del Piemonte, dolci e profumate" },
            { name: "Bronte Pistachios", name_target: "Pistacchi di Bronte", price: "€45,00/kg", description_target: "Pistacchi verdi DOP dell'Etna, raccolti a mano ogni due anni" }
          ]
        },
        {
          name: "Market Vegetables",
          name_target: "Verdure del Mercato",
          items: [
            { name: "San Marzano Tomatoes", name_target: "Pomodori San Marzano DOP", price: "€4,00/kg", description_target: "Pomodori allungati coltivati alle pendici del Vesuvio" },
            { name: "Roman Artichokes", name_target: "Carciofi romaneschi", price: "€2,50/pezzo", description_target: "Carciofi mammole IGP del Lazio, teneri e senza spine" },
            { name: "Porcini Mushrooms", name_target: "Funghi porcini", price: "€30,00/kg", description_target: "Porcini freschi raccolti nei boschi dell'Appennino toscano" },
            { name: "Tropea Onions", name_target: "Cipolle di Tropea", price: "€3,50/kg", description_target: "Cipolle rosse IGP calabresi, dolci e delicate" },
            { name: "Radicchio", name_target: "Radicchio di Treviso", price: "€6,00/kg", description_target: "Radicchio rosso tardivo IGP di Treviso, croccante e amarognolo" }
          ]
        },
        {
          name: "Cheese Selection",
          name_target: "Selezione di Formaggi",
          items: [
            { name: "Parmigiano 36 months", name_target: "Parmigiano Reggiano 36 mesi", price: "€28,00/kg", description_target: "Parmigiano Reggiano DOP stravecchio con cristalli di tirosina" },
            { name: "Buffalo Mozzarella", name_target: "Mozzarella di bufala campana", price: "€14,00/kg", description_target: "Mozzarella DOP artigianale dal Casertano, freschissima" },
            { name: "Gorgonzola", name_target: "Gorgonzola piccante DOP", price: "€16,00/kg", description_target: "Gorgonzola a pasta erborinata stagionato, dal sapore deciso" },
            { name: "Pecorino Romano", name_target: "Pecorino Romano DOP", price: "€18,00/kg", description_target: "Pecorino di latte di pecora laziale, stagionato 8 mesi" }
          ]
        },
        {
          name: "Cured Meats & Pantry",
          name_target: "Salumi e Dispensa",
          items: [
            { name: "Parma Ham", name_target: "Prosciutto di Parma DOP", price: "€30,00/kg", description_target: "Prosciutto crudo stagionato minimo 24 mesi nelle cantine di Langhirano" },
            { name: "Culatello", name_target: "Culatello di Zibello", price: "€50,00/kg", description_target: "Il re dei salumi, stagionato nelle nebbie della Bassa Parmense" },
            { name: "Extra Virgin Olive Oil", name_target: "Olio extravergine d'oliva", price: "€12,00/L", description_target: "Olio EVO toscano da olive frantoiane, spremitura a freddo" },
            { name: "Balsamic Vinegar", name_target: "Aceto balsamico di Modena", price: "€15,00/250ml", description_target: "Aceto balsamico IGP invecchiato in botti di rovere" }
          ]
        }
      ]
    }
  },
  portuguese: {
    beginner: {
      sections: [
        {
          name: "Fruits",
          name_target: "Frutas",
          items: [
            { name: "Oranges", name_target: "Laranjas", price: "R$6,00/kg", description_target: "Laranjas frescas" },
            { name: "Bananas", name_target: "Bananas", price: "R$5,00/kg", description_target: "Bananas maduras" },
            { name: "Mangoes", name_target: "Mangas", price: "R$8,00/kg", description_target: "Mangas doces" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Verduras",
          items: [
            { name: "Tomatoes", name_target: "Tomates", price: "R$7,00/kg", description_target: "Tomates frescos" },
            { name: "Onions", name_target: "Cebolas", price: "R$4,00/kg", description_target: "Cebolas brancas" },
            { name: "Lettuce", name_target: "Alface", price: "R$3,00/unid.", description_target: "Alface fresca" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Tropical Fruits",
          name_target: "Frutas Tropicais",
          items: [
            { name: "Mangoes", name_target: "Mangas Palmer", price: "R$9,00/kg", description_target: "Mangas Palmer maduras e doces" },
            { name: "Passion Fruit", name_target: "Maracujá", price: "R$12,00/kg", description_target: "Maracujá azedo para suco" },
            { name: "Papaya", name_target: "Mamão papaya", price: "R$7,00/kg", description_target: "Mamão papaya da Bahia" },
            { name: "Pineapple", name_target: "Abacaxi", price: "R$6,00/unid.", description_target: "Abacaxi pérola doce e suculento" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Legumes e Verduras",
          items: [
            { name: "Cassava", name_target: "Mandioca", price: "R$5,00/kg", description_target: "Mandioca fresca para cozinhar" },
            { name: "Okra", name_target: "Quiabo", price: "R$8,00/kg", description_target: "Quiabo fresco para receitas mineiras" },
            { name: "Collard Greens", name_target: "Couve manteiga", price: "R$4,00/maço", description_target: "Couve mineira fresca em maço" }
          ]
        },
        {
          name: "Dairy & Deli",
          name_target: "Laticínios e Frios",
          items: [
            { name: "Minas Cheese", name_target: "Queijo Minas", price: "R$35,00/kg", description_target: "Queijo Minas frescal artesanal" },
            { name: "Guava Paste", name_target: "Goiabada cascão", price: "R$15,00/kg", description_target: "Goiabada cascão artesanal mineira" },
            { name: "Linguiça", name_target: "Linguiça calabresa", price: "R$25,00/kg", description_target: "Linguiça calabresa defumada" },
            { name: "Tapioca Flour", name_target: "Goma de tapioca", price: "R$8,00/kg", description_target: "Goma de mandioca para tapioca" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Tropical & Exotic Fruits",
          name_target: "Frutas Tropicais e Exóticas",
          items: [
            { name: "Açaí", name_target: "Açaí", price: "R$25,00/kg", description_target: "Polpa de açaí congelada do Pará, puro e sem adição de açúcar" },
            { name: "Cupuaçu", name_target: "Cupuaçu", price: "R$18,00/kg", description_target: "Polpa de cupuaçu da Amazônia para sucos e sorvetes" },
            { name: "Jabuticaba", name_target: "Jabuticaba", price: "R$20,00/kg", description_target: "Jabuticaba fresca colhida na árvore, safra limitada" },
            { name: "Caju", name_target: "Caju", price: "R$12,00/kg", description_target: "Caju fresco do Ceará com castanha, doce e suculento" },
            { name: "Graviola", name_target: "Graviola", price: "R$15,00/kg", description_target: "Graviola madura para suco, polpa cremosa e aromática" }
          ]
        },
        {
          name: "Vegetables & Roots",
          name_target: "Legumes e Raízes",
          items: [
            { name: "Cassava", name_target: "Mandioca", price: "R$6,00/kg", description_target: "Mandioca amarela de mesa, cozinha rápido e fica macia" },
            { name: "Hearts of Palm", name_target: "Palmito pupunha", price: "R$18,00/unid.", description_target: "Palmito pupunha fresco cultivado de forma sustentável" },
            { name: "Collard Greens", name_target: "Couve manteiga", price: "R$5,00/maço", description_target: "Couve manteiga orgânica em maço grande para feijoada" },
            { name: "Maxixe", name_target: "Maxixe", price: "R$10,00/kg", description_target: "Maxixe fresco do Norte para cozidos e refogados regionais" }
          ]
        },
        {
          name: "Artisan Cheese & Meats",
          name_target: "Queijos e Carnes Artesanais",
          items: [
            { name: "Canastra Cheese", name_target: "Queijo Canastra", price: "R$80,00/kg", description_target: "Queijo artesanal da Serra da Canastra com maturação de 60 dias" },
            { name: "Carne Seca", name_target: "Carne seca", price: "R$55,00/kg", description_target: "Carne seca de primeira qualidade para feijão tropeiro" },
            { name: "Linguiça Mineira", name_target: "Linguiça de porco mineira", price: "R$30,00/kg", description_target: "Linguiça fresca de porco caipira temperada artesanalmente" },
            { name: "Requeijão", name_target: "Requeijão cremoso", price: "R$12,00/pote", description_target: "Requeijão cremoso artesanal de leite de fazenda" }
          ]
        },
        {
          name: "Pantry Staples",
          name_target: "Mercearia",
          items: [
            { name: "Black Beans", name_target: "Feijão preto", price: "R$10,00/kg", description_target: "Feijão preto carioca selecionado para feijoada" },
            { name: "Farofa", name_target: "Farinha de mandioca", price: "R$8,00/kg", description_target: "Farinha de mandioca torrada artesanal do Nordeste" },
            { name: "Dendê Oil", name_target: "Azeite de dendê", price: "R$15,00/500ml", description_target: "Azeite de dendê da Bahia para moqueca e acarajé" },
            { name: "Tucupi", name_target: "Tucupi", price: "R$12,00/L", description_target: "Caldo de mandioca brava fermentado e cozido, base do tacacá paraense" }
          ]
        }
      ]
    }
  },
  japanese: {
    beginner: {
      sections: [
        {
          name: "Fruits",
          name_target: "果物",
          items: [
            { name: "Apples", name_target: "りんご", price: "¥300/個", description_target: "新鮮なりんご" },
            { name: "Bananas", name_target: "バナナ", price: "¥200/房", description_target: "甘いバナナ" },
            { name: "Mandarin Oranges", name_target: "みかん", price: "¥400/袋", description_target: "甘いみかん" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "野菜",
          items: [
            { name: "Daikon Radish", name_target: "大根", price: "¥150/本", description_target: "新鮮な大根" },
            { name: "Green Onions", name_target: "ねぎ", price: "¥120/束", description_target: "長ねぎ一束" },
            { name: "Cabbage", name_target: "キャベツ", price: "¥180/玉", description_target: "新鮮なキャベツ" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Fruits",
          name_target: "果物",
          items: [
            { name: "Fuji Apples", name_target: "ふじりんご", price: "¥350/個", description_target: "青森県産のふじりんご、甘くてシャキシャキ" },
            { name: "Mandarin Oranges", name_target: "温州みかん", price: "¥500/袋", description_target: "愛媛県産の温州みかん" },
            { name: "Strawberries", name_target: "いちご", price: "¥600/パック", description_target: "栃木県産のとちおとめ" },
            { name: "Japanese Pear", name_target: "梨", price: "¥400/個", description_target: "千葉県産の幸水梨、みずみずしい" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "野菜",
          items: [
            { name: "Daikon Radish", name_target: "大根", price: "¥180/本", description_target: "地元産の新鮮な大根" },
            { name: "Shiitake Mushrooms", name_target: "しいたけ", price: "¥300/パック", description_target: "国産の肉厚しいたけ" },
            { name: "Napa Cabbage", name_target: "白菜", price: "¥250/玉", description_target: "鍋料理に最適な白菜" }
          ]
        },
        {
          name: "Fish & Tofu",
          name_target: "鮮魚・豆腐",
          items: [
            { name: "Salmon Fillet", name_target: "鮭の切り身", price: "¥400/切", description_target: "北海道産の生鮭の切り身" },
            { name: "Tofu", name_target: "豆腐", price: "¥120/丁", description_target: "国産大豆の絹ごし豆腐" },
            { name: "Natto", name_target: "納豆", price: "¥100/パック", description_target: "小粒納豆三パック入り" },
            { name: "Miso Paste", name_target: "味噌", price: "¥350/袋", description_target: "信州の合わせ味噌" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Premium Fruits",
          name_target: "厳選果物",
          items: [
            { name: "Aomori Fuji Apples", name_target: "青森ふじりんご", price: "¥500/個", description_target: "青森県産の蜜入りふじりんご、糖度十四度以上の厳選品" },
            { name: "Tochiotome Strawberries", name_target: "とちおとめ", price: "¥800/パック", description_target: "栃木県産の完熟とちおとめ、甘みと酸味の絶妙なバランス" },
            { name: "Shine Muscat Grapes", name_target: "シャインマスカット", price: "¥1,500/房", description_target: "山梨県産の種なしシャインマスカット、皮ごと食べられる" },
            { name: "Yuzu", name_target: "柚子", price: "¥300/個", description_target: "高知県産の香り豊かな柚子、料理やポン酢に" }
          ]
        },
        {
          name: "Seasonal Vegetables",
          name_target: "旬の野菜",
          items: [
            { name: "Matsutake Mushrooms", name_target: "松茸", price: "¥8,000/本", description_target: "国産の天然松茸、秋の味覚の王様" },
            { name: "Kyoto Vegetables", name_target: "京野菜", price: "¥450/束", description_target: "伝統的な京都の水菜や壬生菜の詰め合わせ" },
            { name: "Lotus Root", name_target: "れんこん", price: "¥350/本", description_target: "茨城県産の新鮮なれんこん、シャキシャキ食感" },
            { name: "Bamboo Shoots", name_target: "たけのこ", price: "¥600/本", description_target: "春限定の朝掘りたけのこ、えぐみが少なく柔らか" },
            { name: "Japanese Ginger", name_target: "新生姜", price: "¥400/パック", description_target: "高知県産の新生姜、辛みが穏やかで甘酢漬けに最適" }
          ]
        },
        {
          name: "Seafood",
          name_target: "鮮魚コーナー",
          items: [
            { name: "Sashimi-grade Tuna", name_target: "マグロ刺身用", price: "¥1,200/柵", description_target: "太平洋産の本マグロ赤身、刺身用の柵切り" },
            { name: "Hokkaido Salmon", name_target: "北海道産秋鮭", price: "¥500/切", description_target: "北海道産の脂の乗った秋鮭の切り身" },
            { name: "Shrimp", name_target: "車海老", price: "¥1,500/パック", description_target: "活きの良い国産車海老、天ぷらやお刺身に" },
            { name: "Dried Bonito Flakes", name_target: "鰹節", price: "¥450/袋", description_target: "鹿児島県産の本枯れ節削り、出汁の基本" }
          ]
        },
        {
          name: "Tofu & Fermented Foods",
          name_target: "豆腐・発酵食品",
          items: [
            { name: "Artisan Tofu", name_target: "手作り豆腐", price: "¥250/丁", description_target: "国産大豆と天然にがりで作った手作り木綿豆腐" },
            { name: "Aged Miso", name_target: "三年味噌", price: "¥800/袋", description_target: "天然醸造の三年熟成赤味噌、深い旨みとコク" },
            { name: "Natto", name_target: "大粒納豆", price: "¥150/パック", description_target: "茨城県産の大粒大豆を使った昔ながらの藁納豆" },
            { name: "Pickled Vegetables", name_target: "漬物盛り合わせ", price: "¥500/パック", description_target: "京都の老舗漬物店の千枚漬けとしば漬けの詰め合わせ" }
          ]
        }
      ]
    }
  },
  mandarin: {
    beginner: {
      sections: [
        {
          name: "Fruits",
          name_target: "水果",
          items: [
            { name: "Apples", name_target: "苹果", price: "¥8/斤", description_target: "新鲜红苹果" },
            { name: "Bananas", name_target: "香蕉", price: "¥5/斤", description_target: "甜香蕉" },
            { name: "Oranges", name_target: "橙子", price: "¥6/斤", description_target: "甜橙子" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "蔬菜",
          items: [
            { name: "Chinese Cabbage", name_target: "白菜", price: "¥3/斤", description_target: "新鲜大白菜" },
            { name: "Tomatoes", name_target: "西红柿", price: "¥5/斤", description_target: "红番茄" },
            { name: "Potatoes", name_target: "土豆", price: "¥4/斤", description_target: "新鲜土豆" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Fruits",
          name_target: "水果",
          items: [
            { name: "Fuji Apples", name_target: "富士苹果", price: "¥10/斤", description_target: "山东烟台富士苹果，脆甜多汁" },
            { name: "Lychees", name_target: "荔枝", price: "¥18/斤", description_target: "广东妃子笑荔枝，新鲜到货" },
            { name: "Dragon Fruit", name_target: "火龙果", price: "¥12/个", description_target: "海南红心火龙果" },
            { name: "Pomelo", name_target: "柚子", price: "¥8/个", description_target: "福建琯溪蜜柚，皮薄肉甜" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "蔬菜",
          items: [
            { name: "Bok Choy", name_target: "上海青", price: "¥4/斤", description_target: "嫩绿的上海青小白菜" },
            { name: "Chinese Chives", name_target: "韭菜", price: "¥5/斤", description_target: "新鲜翠绿的韭菜" },
            { name: "Lotus Root", name_target: "莲藕", price: "¥8/斤", description_target: "湖北洪湖鲜藕，脆嫩爽口" }
          ]
        },
        {
          name: "Tofu & Staples",
          name_target: "豆制品和主食",
          items: [
            { name: "Tofu", name_target: "豆腐", price: "¥3/块", description_target: "新鲜手工嫩豆腐" },
            { name: "Rice", name_target: "东北大米", price: "¥30/5kg", description_target: "东北五常大米，粒粒饱满" },
            { name: "Noodles", name_target: "手工面条", price: "¥8/斤", description_target: "现做手擀面条" },
            { name: "Soy Sauce", name_target: "酱油", price: "¥15/瓶", description_target: "传统酿造生抽酱油" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Premium Fruits",
          name_target: "精品水果",
          items: [
            { name: "Yantai Fuji Apples", name_target: "烟台富士苹果", price: "¥12/斤", description_target: "山东烟台红富士苹果，糖心品种，脆甜可口" },
            { name: "Hainan Lychees", name_target: "海南荔枝", price: "¥25/斤", description_target: "海南妃子笑荔枝，果肉饱满，甜而不腻" },
            { name: "Turpan Grapes", name_target: "吐鲁番葡萄", price: "¥15/斤", description_target: "新疆吐鲁番无核白葡萄，日照充足甜度极高" },
            { name: "Yangshan Peaches", name_target: "阳山水蜜桃", price: "¥20/斤", description_target: "无锡阳山水蜜桃，果肉细腻入口即化" },
            { name: "Durian", name_target: "猫山王榴莲", price: "¥50/斤", description_target: "马来西亚进口猫山王榴莲，果肉绵密浓郁" }
          ]
        },
        {
          name: "Seasonal Vegetables",
          name_target: "时令蔬菜",
          items: [
            { name: "Chinese Water Spinach", name_target: "空心菜", price: "¥5/斤", description_target: "嫩绿空心菜，清炒蒜蓉均可，口感脆嫩" },
            { name: "Winter Bamboo Shoots", name_target: "冬笋", price: "¥18/斤", description_target: "浙江临安冬笋，鲜嫩爽脆，冬季限定" },
            { name: "Chinese Toon", name_target: "香椿芽", price: "¥30/斤", description_target: "春季限定香椿嫩芽，香气浓郁适合炒鸡蛋" },
            { name: "Snow Pea Shoots", name_target: "豌豆尖", price: "¥12/斤", description_target: "鲜嫩豌豆苗，清炒或做汤均鲜美无比" }
          ]
        },
        {
          name: "Tofu & Soy Products",
          name_target: "豆制品专区",
          items: [
            { name: "Artisan Tofu", name_target: "手工老豆腐", price: "¥5/块", description_target: "传统石磨研磨的手工卤水老豆腐" },
            { name: "Dried Tofu Sheets", name_target: "千张", price: "¥8/斤", description_target: "薄如纸的手工百叶千张，凉拌炒菜皆宜" },
            { name: "Fermented Tofu", name_target: "腐乳", price: "¥12/瓶", description_target: "王致和红方腐乳，绵软细腻口感醇厚" },
            { name: "Stinky Tofu", name_target: "臭豆腐", price: "¥10/盒", description_target: "长沙正宗臭豆腐，闻着臭吃着香" }
          ]
        },
        {
          name: "Pantry & Condiments",
          name_target: "调味品和干货",
          items: [
            { name: "Wuchang Rice", name_target: "五常大米", price: "¥60/10斤", description_target: "黑龙江五常稻花香大米，颗粒晶莹米香浓郁" },
            { name: "Pixian Doubanjiang", name_target: "郫县豆瓣酱", price: "¥18/瓶", description_target: "四川郫县一年陈酿豆瓣酱，川菜之魂" },
            { name: "Shaoxing Wine", name_target: "绍兴花雕酒", price: "¥35/瓶", description_target: "五年陈绍兴花雕酒，烹饪提鲜去腥必备" },
            { name: "Dried Shiitake", name_target: "香菇干", price: "¥40/250g", description_target: "福建古田花菇，伞面有天然花纹，香味浓郁" },
            { name: "Sichuan Peppercorns", name_target: "花椒", price: "¥25/100g", description_target: "四川汉源花椒，麻香四溢，川菜必备调料" }
          ]
        }
      ]
    }
  },
  korean: {
    beginner: {
      sections: [
        {
          name: "Fruits",
          name_target: "과일",
          items: [
            { name: "Apples", name_target: "사과", price: "₩3,000/개", description_target: "신선한 사과" },
            { name: "Tangerines", name_target: "귤", price: "₩5,000/봉지", description_target: "달콤한 귤" },
            { name: "Bananas", name_target: "바나나", price: "₩3,500/송이", description_target: "잘 익은 바나나" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "채소",
          items: [
            { name: "Napa Cabbage", name_target: "배추", price: "₩4,000/포기", description_target: "김치용 배추" },
            { name: "Green Onions", name_target: "파", price: "₩1,500/단", description_target: "신선한 대파" },
            { name: "Garlic", name_target: "마늘", price: "₩5,000/망", description_target: "한국산 마늘" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Fruits",
          name_target: "과일",
          items: [
            { name: "Apples", name_target: "부사 사과", price: "₩3,500/개", description_target: "경북 영주산 부사 사과" },
            { name: "Jeju Tangerines", name_target: "제주 감귤", price: "₩8,000/3kg", description_target: "제주도산 감귤, 새콤달콤" },
            { name: "Korean Melon", name_target: "참외", price: "₩6,000/봉지", description_target: "성주 참외, 아삭하고 달콤" },
            { name: "Persimmons", name_target: "감", price: "₩4,000/4개", description_target: "경남 진영 단감" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "채소",
          items: [
            { name: "Napa Cabbage", name_target: "배추", price: "₩5,000/포기", description_target: "김장용 해남 배추" },
            { name: "Korean Radish", name_target: "무", price: "₩2,500/개", description_target: "아삭한 국산 무" },
            { name: "Perilla Leaves", name_target: "깻잎", price: "₩2,000/묶음", description_target: "향긋한 깻잎 한 묶음" }
          ]
        },
        {
          name: "Kimchi & Fermented",
          name_target: "김치 & 장류",
          items: [
            { name: "Kimchi", name_target: "배추김치", price: "₩12,000/kg", description_target: "전통 방식으로 담근 배추김치" },
            { name: "Doenjang", name_target: "된장", price: "₩8,000/500g", description_target: "전통 메주로 담근 된장" },
            { name: "Gochujang", name_target: "고추장", price: "₩7,000/500g", description_target: "순창 전통 고추장" },
            { name: "Tofu", name_target: "두부", price: "₩2,500/모", description_target: "국산 콩으로 만든 두부" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Premium Fruits",
          name_target: "프리미엄 과일",
          items: [
            { name: "Yeongju Apples", name_target: "영주 꿀사과", price: "₩5,000/개", description_target: "경북 영주산 꿀사과, 당도 14브릭스 이상 엄선" },
            { name: "Shine Muscat", name_target: "샤인머스캣", price: "₩15,000/송이", description_target: "경북 김천산 샤인머스캣, 껍질째 먹는 고당도 포도" },
            { name: "Hallabong", name_target: "한라봉", price: "₩12,000/5개", description_target: "제주 한라봉, 꼭지가 볼록한 프리미엄 감귤" },
            { name: "Korean Melon", name_target: "성주 참외", price: "₩8,000/봉지", description_target: "성주 금빛 참외, 아삭한 식감과 풍부한 과즙" }
          ]
        },
        {
          name: "Seasonal Vegetables",
          name_target: "제철 채소",
          items: [
            { name: "Wild Greens", name_target: "봄나물 모듬", price: "₩6,000/묶음", description_target: "봄철 한정 달래, 냉이, 쑥 모듬 나물" },
            { name: "Perilla Leaves", name_target: "깻잎", price: "₩2,500/묶음", description_target: "충남 금산산 향긋한 깻잎, 쌈용으로 적합" },
            { name: "Korean Chili Peppers", name_target: "청양고추", price: "₩4,000/봉지", description_target: "매운맛의 대명사 청양고추, 찌개와 양념에 필수" },
            { name: "Sweet Potato", name_target: "해남 고구마", price: "₩6,000/3kg", description_target: "전남 해남 꿀고구마, 촉촉하고 달콤한 밤고구마" },
            { name: "Bellflower Root", name_target: "도라지", price: "₩5,000/묶음", description_target: "강원도산 생도라지, 나물이나 정과로 즐기는 전통 식재료" }
          ]
        },
        {
          name: "Fermented & Traditional",
          name_target: "전통 발효식품",
          items: [
            { name: "Aged Kimchi", name_target: "묵은지", price: "₩18,000/kg", description_target: "일 년 이상 숙성한 전라도 묵은지, 깊은 감칠맛" },
            { name: "Traditional Doenjang", name_target: "전통 된장", price: "₩15,000/500g", description_target: "시골 메주로 삼 년 발효시킨 전통 된장" },
            { name: "Sesame Oil", name_target: "참기름", price: "₩12,000/300ml", description_target: "국산 참깨를 갓 볶아 짠 고소한 참기름" },
            { name: "Salted Shrimp", name_target: "새우젓", price: "₩8,000/500g", description_target: "김장 필수 재료, 강경 전통 새우젓" }
          ]
        },
        {
          name: "Seafood & Meat",
          name_target: "수산물 & 정육",
          items: [
            { name: "Korean Beef", name_target: "한우 등심", price: "₩50,000/300g", description_target: "횡성 한우 1++ 등급 등심, 부드럽고 풍미 깊은 고급 소고기" },
            { name: "Dried Anchovies", name_target: "멸치", price: "₩8,000/300g", description_target: "남해안 국물용 대멸치, 깊은 육수의 기본" },
            { name: "Fresh Squid", name_target: "오징어", price: "₩7,000/마리", description_target: "동해안 싱싱한 생오징어, 회나 볶음용" },
            { name: "Dried Seaweed", name_target: "미역", price: "₩5,000/100g", description_target: "완도산 건미역, 미역국과 무침에 필수" }
          ]
        }
      ]
    }
  },
  arabic: {
    beginner: {
      sections: [
        {
          name: "Fruits",
          name_target: "فواكه",
          items: [
            { name: "Dates", name_target: "تمر", price: "د.إ 25/كغ", description_target: "تمر طازج" },
            { name: "Oranges", name_target: "برتقال", price: "د.إ 8/كغ", description_target: "برتقال حلو" },
            { name: "Watermelon", name_target: "بطيخ", price: "د.إ 5/كغ", description_target: "بطيخ أحمر طازج" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "خضروات",
          items: [
            { name: "Tomatoes", name_target: "طماطم", price: "د.إ 6/كغ", description_target: "طماطم طازجة" },
            { name: "Cucumbers", name_target: "خيار", price: "د.إ 5/كغ", description_target: "خيار أخضر" },
            { name: "Potatoes", name_target: "بطاطس", price: "د.إ 4/كغ", description_target: "بطاطس طازجة" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Fruits",
          name_target: "فواكه",
          items: [
            { name: "Medjool Dates", name_target: "تمر مجهول", price: "د.إ 35/كغ", description_target: "تمر مجهول فاخر من المدينة المنورة" },
            { name: "Pomegranate", name_target: "رمان", price: "د.إ 12/كغ", description_target: "رمان أحمر حلو من إيران" },
            { name: "Figs", name_target: "تين", price: "د.إ 20/كغ", description_target: "تين طازج موسمي" },
            { name: "Grapes", name_target: "عنب", price: "د.إ 15/كغ", description_target: "عنب أبيض بدون بذور" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "خضروات",
          items: [
            { name: "Eggplant", name_target: "باذنجان", price: "د.إ 8/كغ", description_target: "باذنجان أسود للشوي والقلي" },
            { name: "Okra", name_target: "بامية", price: "د.إ 12/كغ", description_target: "بامية خضراء صغيرة طازجة" },
            { name: "Mint", name_target: "نعناع", price: "د.إ 3/حزمة", description_target: "نعناع أخضر طازج" }
          ]
        },
        {
          name: "Dairy & Staples",
          name_target: "ألبان ومواد غذائية",
          items: [
            { name: "Labneh", name_target: "لبنة", price: "د.إ 12/كغ", description_target: "لبنة كريمية طازجة" },
            { name: "Halloumi", name_target: "حلوم", price: "د.إ 25/كغ", description_target: "جبنة حلوم قبرصية للشوي" },
            { name: "Tahini", name_target: "طحينة", price: "د.إ 18/500غ", description_target: "طحينة سمسم طبيعية" },
            { name: "Pita Bread", name_target: "خبز عربي", price: "د.إ 5/ربطة", description_target: "خبز عربي طازج يومي" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Premium Fruits",
          name_target: "فواكه ممتازة",
          items: [
            { name: "Ajwa Dates", name_target: "تمر عجوة المدينة", price: "د.إ 80/كغ", description_target: "تمر عجوة المدينة المنورة الفاخر، ناعم وحلو بنكهة الكراميل" },
            { name: "Pomegranate", name_target: "رمان طائفي", price: "د.إ 18/كغ", description_target: "رمان الطائف الحلو، حبات كبيرة بلون أحمر غامق" },
            { name: "Fresh Figs", name_target: "تين طازج", price: "د.إ 25/كغ", description_target: "تين أخضر وأسود موسمي من تركيا، ناضج ومعسل" },
            { name: "Iranian Pistachios", name_target: "فستق إيراني", price: "د.إ 60/كغ", description_target: "فستق حلبي إيراني محمص وملح خفيف" }
          ]
        },
        {
          name: "Market Vegetables",
          name_target: "خضروات السوق",
          items: [
            { name: "Baby Eggplant", name_target: "باذنجان صغير", price: "د.إ 10/كغ", description_target: "باذنجان صغير للحشو على الطريقة الشامية" },
            { name: "Vine Leaves", name_target: "ورق عنب", price: "د.إ 15/كغ", description_target: "ورق عنب طازج للف المحشي" },
            { name: "Molokhia", name_target: "ملوخية", price: "د.إ 8/حزمة", description_target: "ملوخية خضراء طازجة للطبخ على الطريقة المصرية" },
            { name: "Parsley", name_target: "بقدونس", price: "د.إ 3/حزمة", description_target: "بقدونس أخضر طازج للتبولة والسلطات" },
            { name: "Fresh Thyme", name_target: "زعتر أخضر", price: "د.إ 5/حزمة", description_target: "زعتر بلدي طازج للمناقيش والسلطات" }
          ]
        },
        {
          name: "Dairy & Cheese",
          name_target: "ألبان وأجبان",
          items: [
            { name: "Labneh", name_target: "لبنة بلدية", price: "د.إ 15/كغ", description_target: "لبنة مصفاة كريمية من حليب البقر الطازج" },
            { name: "Akkawi Cheese", name_target: "جبنة عكاوي", price: "د.إ 30/كغ", description_target: "جبنة عكاوي فلسطينية بيضاء مالحة للحلويات والفطائر" },
            { name: "Halloumi", name_target: "جبنة حلوم", price: "د.إ 28/كغ", description_target: "حلوم قبرصي أصلي نصف جاف للشوي على الفحم" },
            { name: "Jameed", name_target: "جميد", price: "د.إ 40/كغ", description_target: "جميد أردني مجفف من حليب الغنم لطبخ المنسف" }
          ]
        },
        {
          name: "Spices & Pantry",
          name_target: "بهارات ومؤونة",
          items: [
            { name: "Za'atar", name_target: "زعتر بلدي مخلوط", price: "د.إ 25/500غ", description_target: "خلطة زعتر فلسطيني بالسمسم والسماق وزيت الزيتون" },
            { name: "Sumac", name_target: "سماق", price: "د.إ 15/250غ", description_target: "سماق أحمر مطحون ناعم، حامض ومنعش للسلطات" },
            { name: "Olive Oil", name_target: "زيت زيتون بكر", price: "د.إ 45/لتر", description_target: "زيت زيتون بكر ممتاز معصور على البارد من فلسطين" },
            { name: "Baharat Spice Mix", name_target: "بهارات مشكلة", price: "د.إ 20/250غ", description_target: "خلطة بهارات عربية سبع بهارات للطبخ الشرقي" },
            { name: "Rose Water", name_target: "ماء ورد", price: "د.إ 12/500مل", description_target: "ماء ورد طائفي طبيعي مقطر للحلويات والمشروبات" }
          ]
        }
      ]
    }
  },
  russian: {
    beginner: {
      sections: [
        {
          name: "Fruits",
          name_target: "Фрукты",
          items: [
            { name: "Apples", name_target: "Яблоки", price: "₽120/кг", description_target: "Свежие красные яблоки" },
            { name: "Bananas", name_target: "Бананы", price: "₽90/кг", description_target: "Спелые бананы" },
            { name: "Oranges", name_target: "Апельсины", price: "₽150/кг", description_target: "Сочные апельсины" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Овощи",
          items: [
            { name: "Potatoes", name_target: "Картофель", price: "₽50/кг", description_target: "Свежий картофель" },
            { name: "Carrots", name_target: "Морковь", price: "₽60/кг", description_target: "Свежая морковь" },
            { name: "Cucumbers", name_target: "Огурцы", price: "₽120/кг", description_target: "Свежие огурцы" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Fruits & Berries",
          name_target: "Фрукты и ягоды",
          items: [
            { name: "Apples", name_target: "Яблоки Антоновка", price: "₽150/кг", description_target: "Яблоки сорта Антоновка, ароматные и кисло-сладкие" },
            { name: "Cranberries", name_target: "Клюква", price: "₽400/кг", description_target: "Свежая клюква из Карелии" },
            { name: "Watermelon", name_target: "Арбуз", price: "₽40/кг", description_target: "Астраханский арбуз, сладкий и сочный" },
            { name: "Cherries", name_target: "Вишня", price: "₽350/кг", description_target: "Вишня из Краснодарского края" }
          ]
        },
        {
          name: "Vegetables",
          name_target: "Овощи",
          items: [
            { name: "Beets", name_target: "Свёкла", price: "₽50/кг", description_target: "Свёкла для борща и салатов" },
            { name: "Cabbage", name_target: "Капуста", price: "₽40/кг", description_target: "Белокочанная капуста для щей" },
            { name: "Dill", name_target: "Укроп", price: "₽50/пучок", description_target: "Свежий укроп с грядки" }
          ]
        },
        {
          name: "Dairy & Staples",
          name_target: "Молочные продукты и бакалея",
          items: [
            { name: "Sour Cream", name_target: "Сметана", price: "₽120/500г", description_target: "Деревенская сметана жирная" },
            { name: "Tvorog", name_target: "Творог", price: "₽150/500г", description_target: "Домашний творог из фермерского молока" },
            { name: "Buckwheat", name_target: "Гречка", price: "₽100/кг", description_target: "Гречневая крупа ядрица" },
            { name: "Rye Bread", name_target: "Бородинский хлеб", price: "₽60/буханка", description_target: "Традиционный ржаной хлеб с кориандром" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Seasonal Fruits & Berries",
          name_target: "Сезонные фрукты и ягоды",
          items: [
            { name: "Antonovka Apples", name_target: "Яблоки Антоновка", price: "₽180/кг", description_target: "Тульская Антоновка из собственного сада, кисло-сладкая с ярким ароматом" },
            { name: "Wild Cranberries", name_target: "Клюква дикая", price: "₽500/кг", description_target: "Дикая клюква из лесов Карелии, собранная вручную" },
            { name: "Sea Buckthorn", name_target: "Облепиха", price: "₽400/кг", description_target: "Алтайская облепиха, кладезь витаминов для варенья и морса" },
            { name: "Lingonberry", name_target: "Брусника", price: "₽600/кг", description_target: "Лесная брусника из Вологодской области, идеальна для мочения" }
          ]
        },
        {
          name: "Market Vegetables",
          name_target: "Овощи с рынка",
          items: [
            { name: "Beets", name_target: "Свёкла столовая", price: "₽60/кг", description_target: "Тёмно-бордовая свёкла для борща и винегрета" },
            { name: "Sauerkraut", name_target: "Квашеная капуста", price: "₽150/кг", description_target: "Квашеная капуста домашнего приготовления с морковью и клюквой" },
            { name: "Pickled Cucumbers", name_target: "Солёные огурцы", price: "₽200/кг", description_target: "Бочковые солёные огурцы с хреном и чесноком по старинному рецепту" },
            { name: "Wild Mushrooms", name_target: "Белые грибы", price: "₽800/кг", description_target: "Свежие белые грибы из подмосковных лесов, для супа и жарки" },
            { name: "Horseradish Root", name_target: "Хрен", price: "₽200/кг", description_target: "Свежий корень хрена для домашнего хренодёра" }
          ]
        },
        {
          name: "Dairy & Fermented",
          name_target: "Молочные и кисломолочные",
          items: [
            { name: "Farm Sour Cream", name_target: "Сметана фермерская", price: "₽180/500г", description_target: "Густая деревенская сметана двадцатипроцентной жирности" },
            { name: "Farm Tvorog", name_target: "Творог домашний", price: "₽200/500г", description_target: "Зернистый фермерский творог из цельного молока" },
            { name: "Kefir", name_target: "Кефир", price: "₽80/л", description_target: "Кефир из фермерского молока на живой закваске" },
            { name: "Ryazhenka", name_target: "Ряженка", price: "₽90/500мл", description_target: "Топлёное молоко, сквашенное до нежной кремовой консистенции" }
          ]
        },
        {
          name: "Pantry & Staples",
          name_target: "Бакалея и крупы",
          items: [
            { name: "Buckwheat", name_target: "Гречка ядрица", price: "₽120/кг", description_target: "Алтайская гречневая крупа первого сорта, рассыпчатая" },
            { name: "Borodinsky Bread", name_target: "Бородинский хлеб", price: "₽70/буханка", description_target: "Заварной ржаной хлеб с кориандром по рецепту девятнадцатого века" },
            { name: "Sunflower Oil", name_target: "Подсолнечное масло", price: "₽150/л", description_target: "Нерафинированное подсолнечное масло холодного отжима с ароматом семечек" },
            { name: "Honey", name_target: "Мёд алтайский", price: "₽600/кг", description_target: "Натуральный алтайский цветочный мёд с пасеки, густой и ароматный" },
            { name: "Dried Mushrooms", name_target: "Сушёные белые грибы", price: "₽1200/100г", description_target: "Сушёные белые грибы из сибирских лесов для ароматного грибного супа" }
          ]
        }
      ]
    }
  }
};

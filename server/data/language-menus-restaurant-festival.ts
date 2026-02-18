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

export const restaurantMenus: Record<string, Record<string, MenuSections>> = {
  spanish: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "Entrantes",
          items: [
            { name: "Gazpacho", name_target: "Gazpacho", price: "€6.00", description_target: "Sopa fría de tomate" },
            { name: "Spanish Omelette", name_target: "Tortilla española", price: "€7.00", description_target: "Tortilla de patata tradicional" },
            { name: "Ham Croquettes", name_target: "Croquetas de jamón", price: "€6.50", description_target: "Croquetas caseras de jamón" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Platos Principales",
          items: [
            { name: "Paella", name_target: "Paella valenciana", price: "€14.00", description_target: "Arroz con mariscos y azafrán" },
            { name: "Grilled Chicken", name_target: "Pollo a la plancha", price: "€11.00", description_target: "Pechuga de pollo a la parrilla" },
            { name: "Grilled Fish", name_target: "Pescado a la plancha", price: "€13.00", description_target: "Pescado fresco del día" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "Entrantes",
          items: [
            { name: "Gazpacho", name_target: "Gazpacho andaluz", price: "€7.00", description_target: "Sopa fría de tomate con pimiento y pepino" },
            { name: "Iberian Ham", name_target: "Jamón ibérico de bellota", price: "€18.00", description_target: "Jamón curado de cerdo ibérico alimentado con bellotas" },
            { name: "Garlic Shrimp", name_target: "Gambas al ajillo", price: "€10.00", description_target: "Gambas salteadas en aceite de oliva con ajo y guindilla" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Platos Principales",
          items: [
            { name: "Seafood Paella", name_target: "Paella de mariscos", price: "€16.00", description_target: "Arroz con gambas, mejillones y calamares en caldo de pescado" },
            { name: "Roasted Suckling Pig", name_target: "Cochinillo asado", price: "€22.00", description_target: "Cochinillo de Segovia asado al horno de leña" },
            { name: "Oxtail Stew", name_target: "Rabo de toro", price: "€18.00", description_target: "Estofado de rabo de toro al vino tinto" },
            { name: "Cod with Pil-Pil Sauce", name_target: "Bacalao al pil-pil", price: "€17.00", description_target: "Bacalao en salsa de aceite de oliva emulsionada con ajo" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Postres",
          items: [
            { name: "Crema Catalana", name_target: "Crema catalana", price: "€6.00", description_target: "Crema de huevo con azúcar caramelizado" },
            { name: "Churros with Chocolate", name_target: "Churros con chocolate", price: "€5.50", description_target: "Churros crujientes con chocolate espeso" },
            { name: "Rice Pudding", name_target: "Arroz con leche", price: "€5.00", description_target: "Arroz con leche cremoso con canela" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "Entrantes",
          items: [
            { name: "Salmorejo", name_target: "Salmorejo cordobés", price: "€8.00", description_target: "Crema fría de tomate y pan con jamón serrano y huevo duro rallado" },
            { name: "Iberian Ham", name_target: "Jamón ibérico de bellota 36 meses", price: "€24.00", description_target: "Jamón ibérico de bellota con denominación de origen de Jabugo, curado durante 36 meses" },
            { name: "Garlic Shrimp", name_target: "Gambas al ajillo", price: "€12.00", description_target: "Gambas frescas salteadas en cazuela de barro con aceite de oliva virgen extra, ajo laminado y guindilla" },
            { name: "Galician Octopus", name_target: "Pulpo a la gallega", price: "€14.00", description_target: "Pulpo cocido al estilo gallego con pimentón de la Vera, aceite de oliva y sal gruesa" },
            { name: "Piquillo Peppers Stuffed with Cod", name_target: "Pimientos del piquillo rellenos de bacalao", price: "€11.00", description_target: "Pimientos de Lodosa rellenos de brandada de bacalao con salsa de piquillos" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Platos Principales",
          items: [
            { name: "Seafood Paella", name_target: "Paella de mariscos del Mediterráneo", price: "€19.00", description_target: "Arroz bomba con gambas rojas, cigalas, mejillones y calamar en caldo de pescado de roca con azafrán de La Mancha" },
            { name: "Roasted Suckling Pig", name_target: "Cochinillo asado segoviano", price: "€26.00", description_target: "Cochinillo lechal asado lentamente en horno de leña siguiendo la receta tradicional castellana" },
            { name: "Oxtail Stew", name_target: "Rabo de toro estofado", price: "€20.00", description_target: "Rabo de toro braseado al vino tinto de Rioja con verduras de temporada y reducción de su jugo" },
            { name: "Grilled Turbot", name_target: "Rodaballo a la brasa", price: "€28.00", description_target: "Rodaballo salvaje de la ría gallega cocinado a la brasa con aceite de oliva arbequina" },
            { name: "Lamb Shoulder", name_target: "Paletilla de cordero lechal", price: "€24.00", description_target: "Paletilla de cordero lechal asada a baja temperatura con romero y patatas panaderas" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Postres",
          items: [
            { name: "Crema Catalana", name_target: "Crema catalana", price: "€7.00", description_target: "Crema de yema de huevo con ralladura de limón y canela, caramelizada al momento" },
            { name: "Santiago Cake", name_target: "Tarta de Santiago", price: "€7.50", description_target: "Tarta de almendra gallega con denominación de origen, decorada con la cruz de Santiago" },
            { name: "Leche Frita", name_target: "Leche frita", price: "€6.50", description_target: "Postre castellano de crema de leche rebozada y frita con azúcar y canela" },
            { name: "Tocino de Cielo", name_target: "Tocino de cielo", price: "€6.00", description_target: "Flan intenso de yema de huevo con caramelo, receta conventual de Jerez" }
          ]
        },
        {
          name: "Wine & Drinks",
          name_target: "Vinos y Bebidas",
          items: [
            { name: "Rioja Reserva", name_target: "Rioja Reserva", price: "€8.00", description_target: "Vino tinto Rioja Reserva, crianza de 24 meses en barrica de roble americano" },
            { name: "Albariño", name_target: "Albariño Rías Baixas", price: "€7.00", description_target: "Vino blanco gallego de uva albariño con aromas frutales y minerales" },
            { name: "Sangría", name_target: "Sangría de la casa", price: "€5.00", description_target: "Sangría artesanal con vino tinto, frutas de temporada y un toque de canela" },
            { name: "Sherry", name_target: "Fino de Jerez", price: "€4.50", description_target: "Vino de Jerez fino, seco y ligero, ideal como aperitivo" }
          ]
        }
      ]
    }
  },
  french: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "Entrées",
          items: [
            { name: "French Onion Soup", name_target: "Soupe à l'oignon", price: "€7.00", description_target: "Soupe à l'oignon gratinée" },
            { name: "Green Salad", name_target: "Salade verte", price: "€5.50", description_target: "Salade fraîche avec vinaigrette" },
            { name: "Pâté", name_target: "Pâté de campagne", price: "€8.00", description_target: "Pâté de campagne avec cornichons" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Plats Principaux",
          items: [
            { name: "Roast Chicken", name_target: "Poulet rôti", price: "€14.00", description_target: "Poulet rôti aux herbes" },
            { name: "Steak with Fries", name_target: "Steak-frites", price: "€16.00", description_target: "Steak grillé avec frites maison" },
            { name: "Croque-Monsieur", name_target: "Croque-monsieur", price: "€10.00", description_target: "Sandwich chaud au jambon et fromage" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "Entrées",
          items: [
            { name: "French Onion Soup", name_target: "Soupe à l'oignon gratinée", price: "€8.00", description_target: "Soupe à l'oignon caramélisé avec croûtons et gruyère fondu" },
            { name: "Escargots", name_target: "Escargots de Bourgogne", price: "€12.00", description_target: "Six escargots au beurre persillé et ail" },
            { name: "Goat Cheese Salad", name_target: "Salade de chèvre chaud", price: "€10.00", description_target: "Salade avec fromage de chèvre gratiné sur toast et noix" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Plats Principaux",
          items: [
            { name: "Coq au Vin", name_target: "Coq au vin", price: "€18.00", description_target: "Poulet mijoté au vin rouge de Bourgogne avec champignons et lardons" },
            { name: "Duck Confit", name_target: "Confit de canard", price: "€20.00", description_target: "Cuisse de canard confite avec pommes sarladaises" },
            { name: "Beef Bourguignon", name_target: "Bœuf bourguignon", price: "€19.00", description_target: "Ragoût de bœuf au vin rouge avec carottes et pommes de terre" },
            { name: "Sole Meunière", name_target: "Sole meunière", price: "€22.00", description_target: "Filet de sole au beurre noisette avec câpres et citron" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Desserts",
          items: [
            { name: "Crème Brûlée", name_target: "Crème brûlée", price: "€7.00", description_target: "Crème à la vanille avec croûte de sucre caramélisé" },
            { name: "Chocolate Mousse", name_target: "Mousse au chocolat", price: "€7.50", description_target: "Mousse légère au chocolat noir" },
            { name: "Tarte Tatin", name_target: "Tarte Tatin", price: "€8.00", description_target: "Tarte aux pommes caramélisées renversée" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "Entrées",
          items: [
            { name: "Foie Gras", name_target: "Foie gras de canard mi-cuit", price: "€18.00", description_target: "Foie gras de canard mi-cuit du Périgord, servi avec chutney de figues et pain d'épices toasté" },
            { name: "Escargots", name_target: "Escargots de Bourgogne", price: "€14.00", description_target: "Douzaine d'escargots de Bourgogne au beurre d'ail et persil plat, gratinés au four" },
            { name: "Lobster Bisque", name_target: "Bisque de homard", price: "€15.00", description_target: "Velouté de homard breton flambé au cognac avec crème fraîche et estragon" },
            { name: "Niçoise Salad", name_target: "Salade niçoise", price: "€12.00", description_target: "Salade traditionnelle niçoise au thon frais, anchois, olives de Nice et œuf poché" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Plats Principaux",
          items: [
            { name: "Coq au Vin", name_target: "Coq au vin de Bourgogne", price: "€22.00", description_target: "Coq fermier mijoté lentement au vin rouge de Bourgogne avec champignons de Paris, oignons grelots et lardons fumés" },
            { name: "Duck Confit", name_target: "Confit de canard du Sud-Ouest", price: "€24.00", description_target: "Cuisse de canard des Landes confite dans sa graisse, accompagnée de pommes sarladaises et salade de roquette" },
            { name: "Rack of Lamb", name_target: "Carré d'agneau en croûte d'herbes", price: "€28.00", description_target: "Carré d'agneau de Sisteron rôti en croûte d'herbes de Provence, jus au romarin et ratatouille" },
            { name: "Dover Sole", name_target: "Sole de Douvres meunière", price: "€32.00", description_target: "Sole entière meunière au beurre noisette, câpres non-pareilles et pommes vapeur" },
            { name: "Cassoulet", name_target: "Cassoulet toulousain", price: "€20.00", description_target: "Cassoulet traditionnel de Toulouse aux haricots tarbais, saucisse de Toulouse et confit de canard" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Desserts",
          items: [
            { name: "Crème Brûlée", name_target: "Crème brûlée à la vanille de Madagascar", price: "€9.00", description_target: "Crème onctueuse à la vanille bourbon de Madagascar avec croûte de sucre caramélisé au chalumeau" },
            { name: "Tarte Tatin", name_target: "Tarte Tatin aux pommes", price: "€10.00", description_target: "Tarte renversée aux pommes Golden caramélisées, servie tiède avec crème fraîche d'Isigny" },
            { name: "Soufflé au Grand Marnier", name_target: "Soufflé au Grand Marnier", price: "€12.00", description_target: "Soufflé léger et aérien au Grand Marnier, préparé à la commande" },
            { name: "Île Flottante", name_target: "Île flottante", price: "€8.00", description_target: "Meringue pochée sur crème anglaise à la vanille avec fils de caramel" }
          ]
        },
        {
          name: "Wine & Drinks",
          name_target: "Vins et Boissons",
          items: [
            { name: "Bordeaux Red", name_target: "Bordeaux rouge Saint-Émilion", price: "€9.00", description_target: "Saint-Émilion Grand Cru aux arômes de fruits noirs et épices douces" },
            { name: "Chablis White", name_target: "Chablis Premier Cru", price: "€10.00", description_target: "Chablis minéral et frais avec notes d'agrumes et de pierre à fusil" },
            { name: "Champagne", name_target: "Champagne Brut", price: "€14.00", description_target: "Champagne brut de la maison, bulles fines et persistantes" },
            { name: "Pastis", name_target: "Pastis de Marseille", price: "€5.00", description_target: "Pastis artisanal servi avec carafe d'eau fraîche" }
          ]
        }
      ]
    }
  },
  german: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "Vorspeisen",
          items: [
            { name: "Pretzel", name_target: "Brezel", price: "€3.50", description_target: "Bayerische Brezel mit Butter" },
            { name: "Potato Soup", name_target: "Kartoffelsuppe", price: "€5.50", description_target: "Cremige Kartoffelsuppe" },
            { name: "Sausage Salad", name_target: "Wurstsalat", price: "€6.00", description_target: "Wurstsalat mit Zwiebeln und Essig" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Hauptgerichte",
          items: [
            { name: "Schnitzel", name_target: "Wiener Schnitzel", price: "€14.00", description_target: "Kalbsschnitzel mit Kartoffelsalat" },
            { name: "Bratwurst", name_target: "Bratwurst", price: "€10.00", description_target: "Gebratene Bratwurst mit Sauerkraut" },
            { name: "Pork Roast", name_target: "Schweinebraten", price: "€13.00", description_target: "Schweinebraten mit Knödeln" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "Vorspeisen",
          items: [
            { name: "Liver Dumpling Soup", name_target: "Leberknödelsuppe", price: "€6.50", description_target: "Klare Rinderbrühe mit hausgemachtem Leberknödel" },
            { name: "Obatzda", name_target: "Obatzda", price: "€7.00", description_target: "Bayerische Käsecreme mit Brezenstücken und Radieschen" },
            { name: "Asparagus Soup", name_target: "Spargelcremesuppe", price: "€7.50", description_target: "Cremige Suppe aus frischem weißem Spargel" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Hauptgerichte",
          items: [
            { name: "Sauerbraten", name_target: "Rheinischer Sauerbraten", price: "€17.00", description_target: "Geschmorter Rinderbraten in würziger Soße mit Kartoffelklößen" },
            { name: "Schnitzel with Spätzle", name_target: "Schnitzel mit Spätzle", price: "€15.00", description_target: "Paniertes Schweineschnitzel mit schwäbischen Spätzle und Soße" },
            { name: "Roast Duck", name_target: "Entenbraten", price: "€19.00", description_target: "Knusprig gebratene Ente mit Rotkohl und Kartoffelknödeln" },
            { name: "Trout", name_target: "Forelle Müllerin", price: "€16.00", description_target: "Gebratene Forelle in Butter mit Mandeln und Petersilienkartoffeln" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Nachspeisen",
          items: [
            { name: "Black Forest Cake", name_target: "Schwarzwälder Kirschtorte", price: "€6.50", description_target: "Schokoladentorte mit Kirschen und Sahne" },
            { name: "Apple Strudel", name_target: "Apfelstrudel", price: "€6.00", description_target: "Warmer Apfelstrudel mit Vanillesoße" },
            { name: "Bavarian Cream", name_target: "Bayerische Creme", price: "€5.50", description_target: "Bayerische Vanillecreme mit Beerenkompott" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "Vorspeisen",
          items: [
            { name: "Liver Dumpling Soup", name_target: "Leberknödelsuppe", price: "€7.50", description_target: "Kräftige Rinderbrühe mit handgemachtem Leberknödel und frischem Schnittlauch" },
            { name: "White Asparagus", name_target: "Spargel mit Sauce Hollandaise", price: "€14.00", description_target: "Frischer weißer Spargel aus der Region mit hausgemachter Sauce Hollandaise und neuen Kartoffeln" },
            { name: "Smoked Trout", name_target: "Geräucherte Forelle", price: "€10.00", description_target: "Geräucherte Bachforelle aus dem Schwarzwald mit Meerrettichsahne und Pumpernickel" },
            { name: "Maultaschen", name_target: "Schwäbische Maultaschen", price: "€9.00", description_target: "Handgemachte Maultaschen gefüllt mit Fleisch und Spinat in Rinderbrühe" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Hauptgerichte",
          items: [
            { name: "Sauerbraten", name_target: "Rheinischer Sauerbraten", price: "€19.00", description_target: "Traditioneller Rinderbraten in würziger Essig-Gewürz-Marinade, langsam geschmort, mit Rosinen-Soße und hausgemachten Kartoffelklößen" },
            { name: "Venison Goulash", name_target: "Hirschgulasch", price: "€22.00", description_target: "Zartes Hirschgulasch aus heimischer Jagd mit Preiselbeeren, Rotkohl und Semmelknödeln" },
            { name: "Roast Goose", name_target: "Gänsebraten", price: "€26.00", description_target: "Knusprig gebratene Gans gefüllt mit Äpfeln und Beifuß, serviert mit Rotkohl und Kartoffelklößen" },
            { name: "Pike-Perch", name_target: "Zanderfilet", price: "€24.00", description_target: "Gebratenes Zanderfilet auf Riesling-Rahm-Soße mit Spargelgemüse und Butterkartoffeln" },
            { name: "Königsberger Klopse", name_target: "Königsberger Klopse", price: "€16.00", description_target: "Ostpreußische Fleischklößchen in weißer Kapernsoße mit Salzkartoffeln und Rote-Bete-Salat" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Nachspeisen",
          items: [
            { name: "Black Forest Cake", name_target: "Schwarzwälder Kirschtorte", price: "€7.50", description_target: "Schokoladenbiskuit mit Sauerkirschen, Kirschwasser und frischer Schlagsahne nach Originalrezept" },
            { name: "Kaiserschmarrn", name_target: "Kaiserschmarrn", price: "€8.00", description_target: "Zerrupfter Pfannkuchen mit Rosinen, Puderzucker und warmem Zwetschgenröster" },
            { name: "Rote Grütze", name_target: "Rote Grütze", price: "€6.00", description_target: "Norddeutsches Beerenkompott aus Johannisbeeren, Himbeeren und Erdbeeren mit Vanillesoße" },
            { name: "Baumkuchen", name_target: "Baumkuchen", price: "€7.00", description_target: "Schichtweise gebackener Kuchen mit Schokoladenglasur, eine Salzwedeler Spezialität" }
          ]
        },
        {
          name: "Wine & Drinks",
          name_target: "Weine und Getränke",
          items: [
            { name: "Riesling", name_target: "Mosel Riesling Spätlese", price: "€7.50", description_target: "Eleganter Riesling von der Mosel mit feiner Frucht und mineralischen Noten" },
            { name: "Spätburgunder", name_target: "Badischer Spätburgunder", price: "€8.00", description_target: "Samtiger Rotwein aus Baden mit Aromen von Kirsche und Waldbeeren" },
            { name: "Wheat Beer", name_target: "Weißbier vom Fass", price: "€4.50", description_target: "Bayerisches Hefeweißbier frisch vom Fass mit fruchtiger Hefenote" },
            { name: "Apple Wine", name_target: "Frankfurter Apfelwein", price: "€3.50", description_target: "Traditioneller Frankfurter Äppelwoi, erfrischend herb und leicht säuerlich" }
          ]
        }
      ]
    }
  },
  italian: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "Antipasti",
          items: [
            { name: "Bruschetta", name_target: "Bruschetta al pomodoro", price: "€6.00", description_target: "Pane tostato con pomodoro e basilico" },
            { name: "Caprese Salad", name_target: "Insalata caprese", price: "€7.00", description_target: "Mozzarella fresca con pomodoro e basilico" },
            { name: "Minestrone", name_target: "Minestrone", price: "€6.50", description_target: "Zuppa di verdure miste" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Primi e Secondi",
          items: [
            { name: "Spaghetti Carbonara", name_target: "Spaghetti alla carbonara", price: "€11.00", description_target: "Pasta con uova, pecorino e guanciale" },
            { name: "Margherita Pizza", name_target: "Pizza margherita", price: "€9.00", description_target: "Pizza con pomodoro, mozzarella e basilico" },
            { name: "Chicken Milanese", name_target: "Cotoletta alla milanese", price: "€13.00", description_target: "Cotoletta di vitello impanata e fritta" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "Antipasti",
          items: [
            { name: "Carpaccio", name_target: "Carpaccio di manzo", price: "€10.00", description_target: "Fettine sottili di manzo crudo con rucola e parmigiano" },
            { name: "Burrata", name_target: "Burrata pugliese", price: "€11.00", description_target: "Burrata fresca con pomodorini e basilico" },
            { name: "Fried Calamari", name_target: "Calamari fritti", price: "€9.00", description_target: "Anelli di calamaro fritti con salsa di limone" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Primi e Secondi",
          items: [
            { name: "Risotto alla Milanese", name_target: "Risotto alla milanese", price: "€14.00", description_target: "Risotto cremoso allo zafferano con burro e parmigiano" },
            { name: "Osso Buco", name_target: "Osso buco alla milanese", price: "€20.00", description_target: "Stinco di vitello brasato con gremolata e risotto allo zafferano" },
            { name: "Sea Bass", name_target: "Branzino al forno", price: "€18.00", description_target: "Branzino intero al forno con patate e olive" },
            { name: "Pappardelle with Wild Boar", name_target: "Pappardelle al cinghiale", price: "€15.00", description_target: "Pappardelle fresche con ragù di cinghiale toscano" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Dolci",
          items: [
            { name: "Tiramisu", name_target: "Tiramisù", price: "€7.00", description_target: "Dolce classico al caffè con mascarpone e cacao" },
            { name: "Panna Cotta", name_target: "Panna cotta", price: "€6.50", description_target: "Panna cotta alla vaniglia con frutti di bosco" },
            { name: "Cannoli", name_target: "Cannoli siciliani", price: "€6.00", description_target: "Cannoli croccanti ripieni di ricotta dolce e gocce di cioccolato" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "Antipasti",
          items: [
            { name: "Vitello Tonnato", name_target: "Vitello tonnato", price: "€12.00", description_target: "Fettine di vitello con salsa tonnata cremosa, capperi e acciughe, ricetta piemontese tradizionale" },
            { name: "Burrata with Prosciutto", name_target: "Burrata con prosciutto di Parma", price: "€14.00", description_target: "Burrata pugliese cremosa con prosciutto di Parma stagionato 24 mesi e pomodorini del Vesuvio" },
            { name: "Octopus Salad", name_target: "Insalata di polpo", price: "€13.00", description_target: "Polpo verace alla griglia con patate, sedano, olive taggiasche e olio extravergine ligure" },
            { name: "Artichoke Roman Style", name_target: "Carciofi alla romana", price: "€10.00", description_target: "Carciofi romaneschi stufati con mentuccia, aglio e prezzemolo secondo la ricetta laziale" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Primi e Secondi",
          items: [
            { name: "Osso Buco", name_target: "Osso buco alla milanese", price: "€24.00", description_target: "Stinco di vitello brasato lentamente nel vino bianco con gremolata di limone e prezzemolo, servito con risotto allo zafferano" },
            { name: "Florentine Steak", name_target: "Bistecca alla fiorentina", price: "€38.00", description_target: "Bistecca di razza chianina cotta alla brace, alta cinque centimetri, servita al sangue con contorno di fagioli all'olio" },
            { name: "Lobster Linguine", name_target: "Linguine all'astice", price: "€26.00", description_target: "Linguine di Gragnano con astice intero, pomodorini pachino e prezzemolo fresco" },
            { name: "Rabbit Cacciatore", name_target: "Coniglio alla cacciatora", price: "€18.00", description_target: "Coniglio in umido con olive, capperi, pomodoro e vino bianco alla maniera toscana" },
            { name: "Truffle Risotto", name_target: "Risotto al tartufo nero", price: "€22.00", description_target: "Risotto carnaroli mantecato con tartufo nero pregiato dell'Umbria e parmigiano reggiano 36 mesi" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Dolci",
          items: [
            { name: "Tiramisu", name_target: "Tiramisù classico", price: "€8.00", description_target: "Tiramisù preparato con savoiardi, mascarpone di Lodi, caffè espresso e cacao amaro del Venezuela" },
            { name: "Sfogliatella", name_target: "Sfogliatella napoletana", price: "€7.00", description_target: "Sfogliatella riccia ripiena di ricotta, semolino e canditi secondo la tradizione napoletana" },
            { name: "Zabaglione", name_target: "Zabaione al Marsala", price: "€8.50", description_target: "Crema calda di tuorli d'uovo montati con zucchero e Marsala Superiore, servita con biscotti secchi" },
            { name: "Cassata", name_target: "Cassata siciliana", price: "€9.00", description_target: "Dolce siciliano con pan di Spagna, ricotta di pecora, frutta candita e glassa di zucchero" }
          ]
        },
        {
          name: "Wine & Drinks",
          name_target: "Vini e Bevande",
          items: [
            { name: "Barolo", name_target: "Barolo DOCG", price: "€12.00", description_target: "Barolo piemontese invecchiato tre anni, note di rosa, catrame e frutti rossi maturi" },
            { name: "Prosecco", name_target: "Prosecco di Valdobbiadene", price: "€7.00", description_target: "Prosecco Superiore DOCG con bollicine fini e note di mela verde e fiori bianchi" },
            { name: "Limoncello", name_target: "Limoncello di Sorrento", price: "€5.00", description_target: "Liquore artigianale di limoni della costiera sorrentina, servito ghiacciato" },
            { name: "Negroni", name_target: "Negroni", price: "€8.00", description_target: "Cocktail fiorentino classico con gin, Campari e vermut rosso, guarnito con scorza d'arancia" }
          ]
        }
      ]
    }
  },
  portuguese: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "Entradas",
          items: [
            { name: "Caldo Verde", name_target: "Caldo verde", price: "R$18.00", description_target: "Sopa de couve com batata e chouriço" },
            { name: "Codfish Cakes", name_target: "Bolinhos de bacalhau", price: "R$22.00", description_target: "Bolinhos fritos de bacalhau" },
            { name: "Bread and Olives", name_target: "Pão e azeitonas", price: "R$12.00", description_target: "Pão caseiro com azeitonas e manteiga" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Pratos Principais",
          items: [
            { name: "Grilled Chicken", name_target: "Frango grelhado", price: "R$38.00", description_target: "Frango grelhado com arroz e batata frita" },
            { name: "Codfish", name_target: "Bacalhau à Brás", price: "R$45.00", description_target: "Bacalhau desfiado com batata palha e ovos" },
            { name: "Steak", name_target: "Picanha grelhada", price: "R$52.00", description_target: "Picanha grelhada com farofa e vinagrete" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "Entradas",
          items: [
            { name: "Caldo Verde", name_target: "Caldo verde", price: "R$20.00", description_target: "Sopa tradicional de couve mineira com batata e linguiça calabresa" },
            { name: "Shrimp Pastéis", name_target: "Pastéis de camarão", price: "R$28.00", description_target: "Pastéis crocantes recheados com camarão e catupiry" },
            { name: "Codfish Cakes", name_target: "Bolinhos de bacalhau", price: "R$26.00", description_target: "Bolinhos de bacalhau com batata e salsa, fritos até dourar" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Pratos Principais",
          items: [
            { name: "Francesinha", name_target: "Francesinha", price: "R$48.00", description_target: "Sanduíche típico do Porto com carnes, queijo e molho especial de cerveja" },
            { name: "Codfish with Cream", name_target: "Bacalhau com natas", price: "R$52.00", description_target: "Bacalhau gratinado com natas, batata e cebola no forno" },
            { name: "Feijoada", name_target: "Feijoada completa", price: "R$55.00", description_target: "Feijoada com feijão preto, carnes de porco, arroz, couve e farofa" },
            { name: "Grilled Sea Bass", name_target: "Robalo grelhado", price: "R$58.00", description_target: "Robalo fresco grelhado com legumes e batata cozida" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Sobremesas",
          items: [
            { name: "Pastel de Nata", name_target: "Pastel de nata", price: "R$12.00", description_target: "Pastel de nata com massa folhada crocante e creme de ovos" },
            { name: "Brigadeiro", name_target: "Brigadeiro", price: "R$8.00", description_target: "Doce de chocolate com leite condensado e granulado" },
            { name: "Pudim", name_target: "Pudim de leite", price: "R$16.00", description_target: "Pudim de leite condensado com calda de caramelo" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "Entradas",
          items: [
            { name: "Caldo Verde", name_target: "Caldo verde à moda do Minho", price: "R$24.00", description_target: "Caldo verde tradicional minhoto com couve galega, batata, azeite virgem extra e chouriço de Trás-os-Montes" },
            { name: "Shrimp with Garlic", name_target: "Camarões ao alho e óleo", price: "R$38.00", description_target: "Camarões frescos salteados no azeite com alho fatiado, pimenta dedo-de-moça e salsinha fresca" },
            { name: "Octopus Salad", name_target: "Salada de polvo", price: "R$42.00", description_target: "Polvo cozido e grelhado com cebola roxa, pimentão, coentro e azeite extra virgem português" },
            { name: "Cheese Platter", name_target: "Tábua de queijos portugueses", price: "R$48.00", description_target: "Seleção de queijo Serra da Estrela, São Jorge e Azeitão com marmelada caseira e nozes" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Pratos Principais",
          items: [
            { name: "Codfish à Gomes de Sá", name_target: "Bacalhau à Gomes de Sá", price: "R$62.00", description_target: "Bacalhau desfiado com batata cozida, cebola, ovos cozidos e azeitonas pretas, gratinado no forno com azeite" },
            { name: "Slow-Roasted Suckling Pig", name_target: "Leitão da Bairrada", price: "R$75.00", description_target: "Leitão assado lentamente à moda da Bairrada com pele crocante, servido com laranja e batata" },
            { name: "Seafood Cataplana", name_target: "Cataplana de mariscos", price: "R$85.00", description_target: "Cataplana algarvia com camarões, amêijoas, mexilhões, chouriço, tomate e coentros frescos" },
            { name: "Duck Rice", name_target: "Arroz de pato", price: "R$58.00", description_target: "Arroz de pato à antiga portuguesa, assado no forno com chouriço, presunto e azeitona preta" },
            { name: "Grilled Octopus", name_target: "Polvo à lagareiro", price: "R$68.00", description_target: "Polvo grelhado regado com azeite virgem extra, alho e batata a murro esmagada" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Sobremesas",
          items: [
            { name: "Pastel de Nata", name_target: "Pastel de nata de Belém", price: "R$14.00", description_target: "Pastel de nata com massa folhada artesanal, creme de gema de ovo e canela, receita conventual" },
            { name: "Serradura", name_target: "Serradura", price: "R$18.00", description_target: "Sobremesa macaense com creme de natas e biscoito Maria triturado, servida gelada" },
            { name: "Toucinho do Céu", name_target: "Toucinho do céu", price: "R$16.00", description_target: "Bolo conventual de amêndoa com gema de ovo e açúcar, receita do Douro" },
            { name: "Queijada de Sintra", name_target: "Queijada de Sintra", price: "R$12.00", description_target: "Doce tradicional de Sintra com requeijão, ovos, açúcar e canela em massa crocante" }
          ]
        },
        {
          name: "Wine & Drinks",
          name_target: "Vinhos e Bebidas",
          items: [
            { name: "Port Wine", name_target: "Vinho do Porto Tawny", price: "R$22.00", description_target: "Vinho do Porto Tawny 10 anos, notas de frutos secos e caramelo, envelhecido em cascos de carvalho" },
            { name: "Vinho Verde", name_target: "Vinho Verde Alvarinho", price: "R$18.00", description_target: "Vinho verde do Minho com notas cítricas e minerais, leve e refrescante" },
            { name: "Ginjinha", name_target: "Ginjinha de Óbidos", price: "R$14.00", description_target: "Licor artesanal de ginja com fruto, especialidade de Óbidos" },
            { name: "Caipirinha", name_target: "Caipirinha", price: "R$20.00", description_target: "Coquetel brasileiro clássico com cachaça artesanal, limão e açúcar" }
          ]
        }
      ]
    }
  },
  japanese: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "前菜",
          items: [
            { name: "Miso Soup", name_target: "味噌汁", price: "¥350", description_target: "豆腐とわかめの味噌汁" },
            { name: "Edamame", name_target: "枝豆", price: "¥400", description_target: "塩茹で枝豆" },
            { name: "Gyoza", name_target: "焼き餃子", price: "¥500", description_target: "焼き餃子六個" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "メインディッシュ",
          items: [
            { name: "Tempura", name_target: "天ぷら", price: "¥1200", description_target: "海老と野菜の天ぷら" },
            { name: "Tonkatsu", name_target: "とんかつ", price: "¥1100", description_target: "豚ロースカツ定食" },
            { name: "Salmon Sashimi", name_target: "サーモン刺身", price: "¥1300", description_target: "新鮮なサーモンの刺身" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "前菜",
          items: [
            { name: "Chawanmushi", name_target: "茶碗蒸し", price: "¥500", description_target: "海老と銀杏入りの蒸し卵料理" },
            { name: "Agedashi Tofu", name_target: "揚げ出し豆腐", price: "¥550", description_target: "揚げ豆腐のだし醤油がけ" },
            { name: "Tataki", name_target: "鰹のたたき", price: "¥900", description_target: "鰹の表面を炙ったたたき、薬味添え" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "メインディッシュ",
          items: [
            { name: "Sukiyaki", name_target: "すき焼き", price: "¥2200", description_target: "牛肉と野菜の甘辛煮込み、生卵添え" },
            { name: "Sashimi Platter", name_target: "刺身盛り合わせ", price: "¥2500", description_target: "本日の鮮魚五種盛り合わせ" },
            { name: "Unagi", name_target: "うな重", price: "¥2800", description_target: "国産鰻の蒲焼き重箱仕立て" },
            { name: "Tempura Set", name_target: "天ぷら定食", price: "¥1800", description_target: "海老二本と季節の野菜天ぷら、ご飯と味噌汁付き" }
          ]
        },
        {
          name: "Desserts",
          name_target: "デザート",
          items: [
            { name: "Matcha Ice Cream", name_target: "抹茶アイス", price: "¥450", description_target: "宇治抹茶のアイスクリーム" },
            { name: "Mochi", name_target: "わらび餅", price: "¥400", description_target: "きな粉と黒蜜のわらび餅" },
            { name: "Dorayaki", name_target: "どら焼き", price: "¥350", description_target: "あんこ入りのふわふわパンケーキ" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "前菜",
          items: [
            { name: "Seasonal Appetizer", name_target: "季節の前菜盛り合わせ", price: "¥1200", description_target: "料理長が厳選した旬の食材を使った前菜五種盛り合わせ" },
            { name: "Seared Wagyu Tataki", name_target: "和牛たたき", price: "¥1800", description_target: "A5ランク和牛のたたき、ポン酢と薬味を添えて" },
            { name: "Sea Urchin Chawanmushi", name_target: "雲丹茶碗蒸し", price: "¥1500", description_target: "北海道産雲丹をのせた贅沢な茶碗蒸し" },
            { name: "Firefly Squid", name_target: "ホタルイカの酢味噌和え", price: "¥900", description_target: "富山産ホタルイカの酢味噌和え、春の味覚" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "メインディッシュ",
          items: [
            { name: "Kaiseki Course", name_target: "会席料理", price: "¥8000", description_target: "料理長おまかせの本格会席コース、旬の食材を活かした八品" },
            { name: "Premium Sashimi Platter", name_target: "特選刺身盛り合わせ", price: "¥3500", description_target: "築地直送の鮮魚七種、中トロ、甘海老、鯛、烏賊、帆立を含む" },
            { name: "Shabu-Shabu", name_target: "黒毛和牛しゃぶしゃぶ", price: "¥4500", description_target: "黒毛和牛の薄切りを昆布出汁でしゃぶしゃぶ、胡麻だれとポン酢で" },
            { name: "Grilled Whole Sea Bream", name_target: "鯛の姿焼き", price: "¥3800", description_target: "明石産天然鯛の一尾丸ごと塩焼き、祝い膳にふさわしい一品" },
            { name: "Wagyu Steak", name_target: "黒毛和牛ステーキ", price: "¥5500", description_target: "A5ランク黒毛和牛サーロインの鉄板焼き、わさびと塩で" }
          ]
        },
        {
          name: "Desserts",
          name_target: "デザート",
          items: [
            { name: "Matcha Parfait", name_target: "抹茶パフェ", price: "¥800", description_target: "宇治抹茶のアイス、白玉、小豆、抹茶ゼリーを重ねた特製パフェ" },
            { name: "Yuzu Sorbet", name_target: "柚子シャーベット", price: "¥500", description_target: "高知産柚子を使った爽やかなシャーベット" },
            { name: "Kuromitsu Warabi Mochi", name_target: "黒蜜わらび餅", price: "¥600", description_target: "本蕨粉で作った上品なわらび餅、沖縄産黒蜜ときな粉添え" },
            { name: "Seasonal Fruits", name_target: "季節のフルーツ盛り合わせ", price: "¥1000", description_target: "厳選された旬の国産フルーツの盛り合わせ" }
          ]
        },
        {
          name: "Drinks",
          name_target: "お飲み物",
          items: [
            { name: "Premium Sake", name_target: "純米大吟醸", price: "¥1200", description_target: "山田錦を使用した純米大吟醸、華やかな吟醸香とすっきりした味わい" },
            { name: "Shochu", name_target: "本格芋焼酎", price: "¥700", description_target: "鹿児島産さつま芋を使った本格焼酎、ロックまたは水割りで" },
            { name: "Plum Wine", name_target: "梅酒", price: "¥600", description_target: "紀州南高梅を使用した自家製梅酒、ロックまたはソーダ割り" },
            { name: "Japanese Beer", name_target: "生ビール", price: "¥550", description_target: "キリンまたはアサヒの生ビール、よく冷えたジョッキで" }
          ]
        }
      ]
    }
  },
  mandarin: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "凉菜",
          items: [
            { name: "Hot and Sour Soup", name_target: "酸辣汤", price: "¥18", description_target: "酸辣开胃汤" },
            { name: "Spring Rolls", name_target: "春卷", price: "¥22", description_target: "炸春卷配甜辣酱" },
            { name: "Cucumber Salad", name_target: "拍黄瓜", price: "¥15", description_target: "蒜香凉拌黄瓜" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "主菜",
          items: [
            { name: "Kung Pao Chicken", name_target: "宫保鸡丁", price: "¥38", description_target: "鸡丁配花生和辣椒" },
            { name: "Fried Rice", name_target: "蛋炒饭", price: "¥25", description_target: "鸡蛋炒饭配蔬菜" },
            { name: "Sweet and Sour Pork", name_target: "糖醋里脊", price: "¥42", description_target: "酸甜口味的炸猪肉" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Cold Dishes",
          name_target: "凉菜",
          items: [
            { name: "Century Egg Tofu", name_target: "皮蛋豆腐", price: "¥22", description_target: "冰镇嫩豆腐配松花皮蛋和香葱" },
            { name: "Sichuan Cold Noodles", name_target: "四川凉面", price: "¥25", description_target: "麻辣口味的凉拌面条配花生碎" },
            { name: "Smoked Tofu", name_target: "熏干拌香芹", price: "¥20", description_target: "熏香干丝拌芹菜和花椒油" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "主菜",
          items: [
            { name: "Mapo Tofu", name_target: "麻婆豆腐", price: "¥35", description_target: "四川传统麻辣豆腐配肉末和花椒" },
            { name: "Peking Duck", name_target: "北京烤鸭", price: "¥128", description_target: "传统北京烤鸭配薄饼、葱丝和甜面酱" },
            { name: "Twice-Cooked Pork", name_target: "回锅肉", price: "¥42", description_target: "川味回锅肉配蒜苗和辣豆瓣酱" },
            { name: "Steamed Fish", name_target: "清蒸鲈鱼", price: "¥68", description_target: "清蒸鲈鱼配姜丝和葱花" }
          ]
        },
        {
          name: "Desserts",
          name_target: "甜点",
          items: [
            { name: "Egg Tart", name_target: "蛋挞", price: "¥12", description_target: "酥脆蛋挞配香滑蛋奶馅" },
            { name: "Sesame Balls", name_target: "芝麻球", price: "¥15", description_target: "炸芝麻汤圆配红豆馅" },
            { name: "Mango Pudding", name_target: "芒果布丁", price: "¥18", description_target: "新鲜芒果布丁配椰浆" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Cold Dishes",
          name_target: "凉菜",
          items: [
            { name: "Drunken Chicken", name_target: "醉鸡", price: "¥38", description_target: "上海传统冷菜，嫩鸡肉浸泡在绍兴花雕酒中，配枸杞和当归" },
            { name: "Jellyfish Salad", name_target: "凉拌海蜇", price: "¥35", description_target: "爽脆海蜇丝配醋、麻油和芝麻，清爽开胃" },
            { name: "Five-Spice Beef Shank", name_target: "五香酱牛肉", price: "¥45", description_target: "精选牛腱子肉用五香料慢炖入味，切薄片配香菜和辣油" },
            { name: "Smashed Cucumber", name_target: "老醋拍黄瓜", price: "¥18", description_target: "拍碎黄瓜配陈醋、蒜末、香油和花椒油" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "主菜",
          items: [
            { name: "Peking Duck", name_target: "正宗北京烤鸭", price: "¥168", description_target: "精选北京填鸭挂炉烤制，皮脆肉嫩，配荷叶饼、葱丝、黄瓜条和甜面酱" },
            { name: "Dongpo Pork", name_target: "东坡肉", price: "¥68", description_target: "杭州名菜，五花肉用绍兴酒和酱油慢炖三小时，入口即化" },
            { name: "Squirrel-Shaped Mandarin Fish", name_target: "松鼠鳜鱼", price: "¥98", description_target: "苏州名菜，鳜鱼炸成松鼠形，浇以酸甜番茄酱汁，外酥里嫩" },
            { name: "Lion's Head Meatballs", name_target: "红烧狮子头", price: "¥58", description_target: "淮扬名菜，手工制作的大肉圆配青菜，在砂锅中炖煮入味" },
            { name: "Kung Pao Shrimp", name_target: "宫保虾仁", price: "¥78", description_target: "鲜虾仁配花生、干辣椒和花椒，正宗川味宫保做法" }
          ]
        },
        {
          name: "Desserts",
          name_target: "甜点",
          items: [
            { name: "Eight Treasure Rice", name_target: "八宝饭", price: "¥38", description_target: "上海传统甜点，糯米饭配红豆沙、莲子、枣和各种蜜饯果脯" },
            { name: "Osmanthus Jelly", name_target: "桂花糕", price: "¥22", description_target: "清香桂花糕配蜂蜜和枸杞，口感细腻清甜" },
            { name: "Tangyuan", name_target: "黑芝麻汤圆", price: "¥25", description_target: "手工糯米汤圆配黑芝麻馅，在甜酒酿中煮制" },
            { name: "Candied Hawthorn", name_target: "冰糖葫芦", price: "¥15", description_target: "老北京传统小吃，山楂裹上冰糖外衣，酸甜可口" }
          ]
        },
        {
          name: "Tea & Drinks",
          name_target: "茶饮",
          items: [
            { name: "Longjing Tea", name_target: "西湖龙井", price: "¥48", description_target: "杭州西湖产区明前龙井，色绿香郁味甘形美" },
            { name: "Pu'er Tea", name_target: "云南普洱茶", price: "¥38", description_target: "云南陈年普洱熟茶，醇厚回甘，十年窖藏" },
            { name: "Baijiu", name_target: "白酒", price: "¥58", description_target: "中国传统白酒，酱香型，醇厚绵长" },
            { name: "Osmanthus Wine", name_target: "桂花酒", price: "¥35", description_target: "绍兴桂花酒，低度甜酒，桂花清香宜人" }
          ]
        }
      ]
    }
  },
  korean: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "전채",
          items: [
            { name: "Kimchi", name_target: "김치", price: "₩5,000", description_target: "전통 배추김치" },
            { name: "Seaweed Soup", name_target: "미역국", price: "₩7,000", description_target: "따뜻한 미역국" },
            { name: "Korean Pancake", name_target: "파전", price: "₩8,000", description_target: "파와 해물이 들어간 전" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "메인 요리",
          items: [
            { name: "Bibimbap", name_target: "비빔밥", price: "₩10,000", description_target: "밥 위에 야채와 고추장" },
            { name: "Bulgogi", name_target: "불고기", price: "₩15,000", description_target: "양념 소고기 구이" },
            { name: "Kimchi Stew", name_target: "김치찌개", price: "₩9,000", description_target: "돼지고기와 김치 찌개" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "전채",
          items: [
            { name: "Japchae", name_target: "잡채", price: "₩10,000", description_target: "당면과 야채를 참기름에 볶은 전통 잡채" },
            { name: "Seafood Pancake", name_target: "해물파전", price: "₩12,000", description_target: "해산물과 파가 듬뿍 들어간 바삭한 전" },
            { name: "Egg Roll", name_target: "계란말이", price: "₩7,000", description_target: "야채를 넣어 돌돌 말아 구운 계란말이" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "메인 요리",
          items: [
            { name: "Galbi", name_target: "갈비", price: "₩25,000", description_target: "양념에 재운 소갈비를 숯불에 구운 요리" },
            { name: "Doenjang Stew", name_target: "된장찌개", price: "₩9,000", description_target: "된장과 두부, 야채를 넣고 끓인 전통 찌개" },
            { name: "Samgyeopsal", name_target: "삼겹살", price: "₩16,000", description_target: "두툼한 삼겹살을 직화로 구워 쌈에 싸서 먹는 요리" },
            { name: "Sundubu Jjigae", name_target: "순두부찌개", price: "₩10,000", description_target: "부드러운 순두부와 해물, 달걀이 들어간 매콤한 찌개" }
          ]
        },
        {
          name: "Desserts & Drinks",
          name_target: "디저트 & 음료",
          items: [
            { name: "Bingsu", name_target: "팥빙수", price: "₩9,000", description_target: "곱게 간 얼음 위에 팥과 떡, 과일을 올린 빙수" },
            { name: "Sikhye", name_target: "식혜", price: "₩4,000", description_target: "달콤한 전통 쌀 음료" },
            { name: "Hotteok", name_target: "호떡", price: "₩3,000", description_target: "흑설탕과 견과류가 들어간 달콤한 전병" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "전채",
          items: [
            { name: "Nine-Section Platter", name_target: "구절판", price: "₩18,000", description_target: "아홉 가지 색채의 재료를 밀전병에 싸서 먹는 궁중 요리" },
            { name: "Japchae", name_target: "궁중잡채", price: "₩14,000", description_target: "당면과 오색 채소를 참기름에 볶아 전통 양념으로 맛을 낸 궁중식 잡채" },
            { name: "Seafood Pancake", name_target: "동래파전", price: "₩15,000", description_target: "부산 동래 전통 방식으로 해산물과 파를 넣어 바삭하게 부친 전" },
            { name: "Raw Beef", name_target: "육회", price: "₩20,000", description_target: "한우 안심을 곱게 채 썰어 참기름, 배즙, 잣가루와 함께 내는 전통 요리" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "메인 요리",
          items: [
            { name: "Hanwoo Galbi", name_target: "한우 갈비", price: "₩45,000", description_target: "최상급 한우 갈비를 전통 양념에 재워 참숯불에 구운 프리미엄 갈비" },
            { name: "Royal Court Ribs", name_target: "갈비찜", price: "₩35,000", description_target: "소갈비를 간장, 배즙, 대추와 함께 오래 졸여 부드럽게 만든 궁중식 갈비찜" },
            { name: "Abalone Porridge", name_target: "전복죽", price: "₩18,000", description_target: "제주산 전복을 참기름에 볶아 쌀과 함께 푹 끓인 보양 죽" },
            { name: "Ginseng Chicken Soup", name_target: "삼계탕", price: "₩22,000", description_target: "어린 닭 속에 인삼, 대추, 찹쌀, 마늘을 넣어 오래 고아 만든 보양식" },
            { name: "Grilled Hanwoo Sirloin", name_target: "한우 등심 구이", price: "₩55,000", description_target: "1++ 등급 한우 등심을 소금과 참기름으로 간하여 숯불에 구운 최고급 구이" }
          ]
        },
        {
          name: "Desserts",
          name_target: "디저트",
          items: [
            { name: "Yakgwa", name_target: "약과", price: "₩8,000", description_target: "밀가루를 참기름과 꿀로 반죽하여 기름에 튀긴 후 조청에 절인 전통 과자" },
            { name: "Songpyeon", name_target: "송편", price: "₩7,000", description_target: "솔잎 향이 배인 떡 속에 깨와 꿀을 넣어 빚은 전통 송편" },
            { name: "Patbingsu", name_target: "전통 팥빙수", price: "₩12,000", description_target: "우유 얼음을 곱게 갈아 수제 팥앙금, 인절미, 경단, 과일을 올린 특선 빙수" },
            { name: "Sujeonggwa", name_target: "수정과", price: "₩5,000", description_target: "계피와 생강을 달여 만든 전통 음료에 곶감을 띄워 차갑게 낸 후식" }
          ]
        },
        {
          name: "Drinks",
          name_target: "음료",
          items: [
            { name: "Makgeolli", name_target: "전통 막걸리", price: "₩8,000", description_target: "국산 쌀로 빚은 전통 탁주, 은은한 단맛과 부드러운 탄산이 특징" },
            { name: "Soju", name_target: "참이슬 소주", price: "₩5,000", description_target: "대한민국 대표 증류주, 깔끔하고 부드러운 맛" },
            { name: "Bokbunja Wine", name_target: "복분자주", price: "₩10,000", description_target: "고창산 복분자를 발효시켜 만든 과실주, 달콤하고 진한 맛" },
            { name: "Omija Tea", name_target: "오미자차", price: "₩6,000", description_target: "다섯 가지 맛을 지닌 오미자를 우려낸 전통차, 차갑게 또는 따뜻하게" }
          ]
        }
      ]
    }
  },
  arabic: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "مقبلات",
          items: [
            { name: "Hummus", name_target: "حمص", price: "١٥ د.إ", description_target: "حمص مهروس بالطحينة" },
            { name: "Fattoush", name_target: "فتوش", price: "١٨ د.إ", description_target: "سلطة خضراء مع خبز محمص" },
            { name: "Lentil Soup", name_target: "شوربة عدس", price: "١٢ د.إ", description_target: "شوربة عدس أحمر" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "أطباق رئيسية",
          items: [
            { name: "Shawarma", name_target: "شاورما", price: "٢٥ د.إ", description_target: "شاورما لحم مع خبز" },
            { name: "Kabsa", name_target: "كبسة", price: "٣٥ د.إ", description_target: "أرز بالدجاج والبهارات" },
            { name: "Grilled Kebab", name_target: "كباب مشوي", price: "٣٠ د.إ", description_target: "كباب لحم مشوي على الفحم" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "مقبلات",
          items: [
            { name: "Hummus", name_target: "حمص بالطحينة", price: "١٨ د.إ", description_target: "حمص مهروس ناعم مع طحينة وزيت زيتون وبقدونس" },
            { name: "Mutabbal", name_target: "متبل", price: "٢٠ د.إ", description_target: "باذنجان مشوي مهروس مع طحينة وعصير ليمون وثوم" },
            { name: "Kibbeh", name_target: "كبة", price: "٢٢ د.إ", description_target: "كبة مقلية محشوة باللحم والصنوبر والبهارات" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "أطباق رئيسية",
          items: [
            { name: "Lamb Mansaf", name_target: "منسف", price: "٤٥ د.إ", description_target: "لحم ضأن مطبوخ مع لبن الجميد والأرز واللوز" },
            { name: "Mixed Grill", name_target: "مشاوي مشكلة", price: "٥٥ د.إ", description_target: "تشكيلة من اللحوم المشوية مع كباب وشقف ودجاج" },
            { name: "Stuffed Grape Leaves", name_target: "ورق عنب", price: "٢٨ د.إ", description_target: "أوراق عنب محشوة بالأرز واللحم المفروم والبهارات" },
            { name: "Chicken Mandi", name_target: "مندي دجاج", price: "٣٨ د.إ", description_target: "دجاج مطبوخ على الحطب مع أرز بسمتي والبهارات اليمنية" }
          ]
        },
        {
          name: "Desserts",
          name_target: "حلويات",
          items: [
            { name: "Baklava", name_target: "بقلاوة", price: "٢٠ د.إ", description_target: "طبقات رقيقة من العجين محشوة بالفستق والجوز مع شراب السكر" },
            { name: "Kunafa", name_target: "كنافة", price: "٢٥ د.إ", description_target: "كنافة ساخنة بالجبن مع شراب السكر" },
            { name: "Umm Ali", name_target: "أم علي", price: "١٨ د.إ", description_target: "حلوى مصرية بالعجين والحليب والمكسرات" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "مقبلات",
          items: [
            { name: "Muhammara", name_target: "محمرة", price: "٢٥ د.إ", description_target: "معجون الفلفل الأحمر المشوي مع الجوز المطحون ودبس الرمان وزيت الزيتون البكر على الطريقة الحلبية" },
            { name: "Lamb Kibbeh Nayeh", name_target: "كبة نيئة", price: "٣٠ د.إ", description_target: "كبة لحم ضأن نيئة مع برغل ناعم وبصل وبهارات لبنانية تقليدية، تقدم مع زيت زيتون وأوراق نعناع" },
            { name: "Fatteh", name_target: "فتة", price: "٢٨ د.إ", description_target: "طبقات من الخبز المحمص مع الحمص واللبن المطبوخ والصنوبر المحمص وزيت الزيتون" },
            { name: "Shanklish", name_target: "شنكليش", price: "٢٢ د.إ", description_target: "كرات جبن معتقة مفتتة مع طماطم وبصل وزيت زيتون ونعناع مجفف" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "أطباق رئيسية",
          items: [
            { name: "Lamb Mansaf", name_target: "منسف أردني أصيل", price: "٦٠ د.إ", description_target: "لحم ضأن بلدي مطبوخ مع لبن الجميد الكركي على أرز طويل الحبة مع اللوز والصنوبر المحمص" },
            { name: "Machboos", name_target: "مجبوس لحم", price: "٥٥ د.إ", description_target: "أرز بسمتي مع لحم ضأن مطهو ببطء في خلطة بهارات خليجية مع لومي وزعفران وماء ورد" },
            { name: "Stuffed Lamb", name_target: "خروف محشي", price: "٨٠ د.إ", description_target: "خروف كامل محشو بالأرز المبهر والمكسرات والزبيب، مطبوخ في التنور على الطريقة البدوية" },
            { name: "Sayyadieh", name_target: "صيادية سمك", price: "٤٥ د.إ", description_target: "فيليه سمك هامور مع أرز بالبصل المكرمل والبهارات وصلصة الطحينة، من المطبخ اللبناني الساحلي" },
            { name: "Chicken Musakhan", name_target: "مسخن دجاج", price: "٤٨ د.إ", description_target: "دجاج مشوي فوق خبز الطابون مع بصل مكرمل بالسماق وزيت الزيتون والصنوبر" }
          ]
        },
        {
          name: "Desserts",
          name_target: "حلويات",
          items: [
            { name: "Kunafa Nabulsia", name_target: "كنافة نابلسية", price: "٣٠ د.إ", description_target: "كنافة تقليدية بالجبن النابلسي الطازج مع شعيرية مقرمشة وشراب السكر بماء الورد" },
            { name: "Halawet el-Jibn", name_target: "حلاوة الجبن", price: "٢٨ د.إ", description_target: "لفائف من عجينة الجبن والسميد محشوة بالقشطة، مع شراب الورد والفستق الحلبي" },
            { name: "Maamoul", name_target: "معمول", price: "٢٢ د.إ", description_target: "كعك تقليدي محشو بالتمر أو الجوز أو الفستق، مزين بالسكر الناعم" },
            { name: "Basbousa", name_target: "بسبوسة", price: "٢٠ د.إ", description_target: "كعكة السميد المشبعة بشراب السكر مع ماء الزهر واللوز المحمص" }
          ]
        },
        {
          name: "Drinks",
          name_target: "مشروبات",
          items: [
            { name: "Arabic Coffee", name_target: "قهوة عربية", price: "١٥ د.إ", description_target: "قهوة عربية تقليدية بالهيل مع التمر، محمصة ومحضرة على الطريقة الخليجية الأصيلة" },
            { name: "Jallab", name_target: "جلاب", price: "١٨ د.إ", description_target: "مشروب تقليدي من دبس التمر وماء الورد والصنوبر والزبيب، مقدم مع الثلج" },
            { name: "Sahlab", name_target: "سحلب", price: "٢٠ د.إ", description_target: "مشروب ساخن كريمي من مسحوق بصل الأوركيد مع القرفة والفستق وجوز الهند" },
            { name: "Turkish Coffee", name_target: "قهوة تركية", price: "١٢ د.إ", description_target: "قهوة مطحونة ناعماً ومحضرة في الركوة على النار، تقدم مع ماء الورد" }
          ]
        }
      ]
    }
  },
  russian: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "Закуски",
          items: [
            { name: "Borscht", name_target: "Борщ", price: "₽350", description_target: "Свекольный суп со сметаной" },
            { name: "Olivier Salad", name_target: "Салат Оливье", price: "₽300", description_target: "Традиционный салат с овощами и майонезом" },
            { name: "Bread Basket", name_target: "Хлебная корзина", price: "₽150", description_target: "Ржаной и пшеничный хлеб" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Горячие блюда",
          items: [
            { name: "Pelmeni", name_target: "Пельмени", price: "₽450", description_target: "Пельмени с мясом и сметаной" },
            { name: "Beef Stroganoff", name_target: "Бефстроганов", price: "₽550", description_target: "Говядина в сливочном соусе с гречкой" },
            { name: "Chicken Cutlet", name_target: "Котлета по-киевски", price: "₽500", description_target: "Куриная котлета с маслом внутри" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "Закуски",
          items: [
            { name: "Borscht", name_target: "Украинский борщ", price: "₽400", description_target: "Наваристый борщ со свёклой, капустой и свининой, подаётся со сметаной и чесночными пампушками" },
            { name: "Herring Under Fur Coat", name_target: "Селёдка под шубой", price: "₽380", description_target: "Слоёный салат с сельдью, свёклой, картофелем, морковью и майонезом" },
            { name: "Mushroom Julienne", name_target: "Жульен с грибами", price: "₽420", description_target: "Грибы в сливочном соусе, запечённые с сыром в кокотнице" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Горячие блюда",
          items: [
            { name: "Pelmeni", name_target: "Сибирские пельмени", price: "₽500", description_target: "Домашние пельмени с тремя видами мяса, подаются со сметаной и зеленью" },
            { name: "Shashlik", name_target: "Шашлык из баранины", price: "₽750", description_target: "Маринованная баранина, жаренная на углях, с луком и зеленью" },
            { name: "Beef Stroganoff", name_target: "Бефстроганов", price: "₽650", description_target: "Нежная говядина в грибном сливочном соусе с картофельным пюре" },
            { name: "Salmon in Pastry", name_target: "Кулебяка с сёмгой", price: "₽700", description_target: "Традиционный пирог с сёмгой, рисом и яйцом в слоёном тесте" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Десерты",
          items: [
            { name: "Blini with Caviar", name_target: "Блины с икрой", price: "₽800", description_target: "Тонкие блины с красной икрой и сметаной" },
            { name: "Honey Cake", name_target: "Медовик", price: "₽350", description_target: "Многослойный медовый торт со сметанным кремом" },
            { name: "Syrniki", name_target: "Сырники", price: "₽320", description_target: "Творожные оладьи с ягодным вареньем и сметаной" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "Закуски",
          items: [
            { name: "Borscht", name_target: "Борщ по-старорусски", price: "₽450", description_target: "Борщ на говяжьем бульоне с копчёными рёбрышками, молодой свёклой и зеленью, подаётся с чесночными пампушками и домашней сметаной" },
            { name: "Beef Tartare", name_target: "Тартар из мраморной говядины", price: "₽650", description_target: "Тартар из мраморной говядины с каперсами, корнишонами, яичным желтком и трюфельным маслом" },
            { name: "Smoked Sturgeon", name_target: "Копчёный осётр", price: "₽900", description_target: "Нежный осётр холодного копчения с хреном, лимоном и гренками из бородинского хлеба" },
            { name: "Mushroom Julienne", name_target: "Жульен из белых грибов", price: "₽550", description_target: "Благородные белые грибы в сливочном соусе с луком-шалот, запечённые под корочкой грюйера в кокотнице" }
          ]
        },
        {
          name: "Main Courses",
          name_target: "Горячие блюда",
          items: [
            { name: "Pelmeni", name_target: "Уральские пельмени ручной лепки", price: "₽600", description_target: "Пельмени ручной работы с начинкой из трёх видов мяса — говядины, свинины и лосятины, подаются со сметаной и топлёным маслом" },
            { name: "Lamb Shashlik", name_target: "Шашлык из каре ягнёнка", price: "₽950", description_target: "Каре молодого ягнёнка на кости, маринованное в кавказских специях, жаренное на виноградной лозе с ткемали и свежей зеленью" },
            { name: "Chicken Pozharsky", name_target: "Пожарская котлета", price: "₽700", description_target: "Историческая котлета из рубленого куриного мяса с добавлением сливок и белого хлеба, обжаренная в сухарях, с молодым картофелем" },
            { name: "Pike Perch", name_target: "Судак по-московски", price: "₽850", description_target: "Филе судака, запечённое под грибным соусом с картофелем и сыром, по старинному московскому рецепту" },
            { name: "Beef Stroganoff", name_target: "Бефстроганов из вырезки", price: "₽800", description_target: "Говяжья вырезка, нарезанная соломкой, в соусе из белых грибов, горчицы и сметаны, подаётся с картофелем «пай»" }
          ]
        },
        {
          name: "Desserts",
          name_target: "Десерты",
          items: [
            { name: "Blini with Caviar", name_target: "Блины с чёрной икрой", price: "₽1500", description_target: "Тончайшие гречневые блины с осетровой чёрной икрой, сметаной и мелко нарезанным шнитт-луком" },
            { name: "Honey Cake", name_target: "Медовик по-тульски", price: "₽400", description_target: "Классический многослойный медовый торт с нежным сметанным кремом по тульскому рецепту девятнадцатого века" },
            { name: "Bird's Milk Cake", name_target: "Торт «Птичье молоко»", price: "₽450", description_target: "Легендарный советский торт с нежным суфле из агар-агара на бисквитной основе с шоколадной глазурью" },
            { name: "Paskha", name_target: "Пасха творожная", price: "₽380", description_target: "Праздничный десерт из протёртого творога с цукатами, изюмом, орехами и ванилью в традиционной пирамидальной форме" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Напитки",
          items: [
            { name: "Russian Vodka", name_target: "Водка «Белуга»", price: "₽400", description_target: "Премиальная русская водка тройной дистилляции из отборного зерна, подаётся охлаждённой с солёными огурцами" },
            { name: "Kvass", name_target: "Домашний квас", price: "₽200", description_target: "Традиционный хлебный квас на закваске из бородинского хлеба, натурального брожения" },
            { name: "Sea Buckthorn Tea", name_target: "Облепиховый чай", price: "₽300", description_target: "Согревающий чай из свежей облепихи с мёдом, имбирём и палочкой корицы" },
            { name: "Mors", name_target: "Морс из клюквы", price: "₽250", description_target: "Освежающий напиток из свежей клюквы с натуральным мёдом, подаётся холодным" }
          ]
        }
      ]
    }
  }
};

export const localFestivalMenus: Record<string, Record<string, MenuSections>> = {
  spanish: {
    beginner: {
      sections: [
        {
          name: "Street Food",
          name_target: "Comida Callejera",
          items: [
            { name: "Churros", name_target: "Churros", price: "€3.00", description_target: "Churros con azúcar" },
            { name: "Patatas Bravas", name_target: "Patatas bravas", price: "€4.00", description_target: "Patatas fritas con salsa picante" },
            { name: "Bocadillo", name_target: "Bocadillo de jamón", price: "€4.50", description_target: "Bocadillo con jamón serrano" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Bebidas",
          items: [
            { name: "Sangría", name_target: "Sangría", price: "€3.00", description_target: "Sangría de vino tinto con frutas" },
            { name: "Lemonade", name_target: "Limonada", price: "€2.00", description_target: "Limonada fresca natural" },
            { name: "Beer", name_target: "Cerveza", price: "€2.50", description_target: "Cerveza fría de barril" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Street Food",
          name_target: "Comida Callejera",
          items: [
            { name: "Churros with Chocolate", name_target: "Churros con chocolate", price: "€4.50", description_target: "Churros recién hechos con chocolate caliente para mojar" },
            { name: "Pinchos", name_target: "Pinchos variados", price: "€3.00", description_target: "Brochetas de carne, pescado y verduras a la plancha" },
            { name: "Empanadas", name_target: "Empanadas gallegas", price: "€3.50", description_target: "Empanadas rellenas de atún o carne" },
            { name: "Pulpo a Feira", name_target: "Pulpo a feira", price: "€6.00", description_target: "Pulpo cocido con pimentón y aceite de oliva" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "Parrilla",
          items: [
            { name: "Grilled Sardines", name_target: "Sardinas a la parrilla", price: "€5.00", description_target: "Sardinas frescas asadas con sal gorda y limón" },
            { name: "Chorizo Sandwich", name_target: "Bocadillo de chorizo", price: "€4.00", description_target: "Chorizo a la brasa en pan de pueblo" },
            { name: "Lamb Skewers", name_target: "Pinchos morunos", price: "€5.50", description_target: "Brochetas de cordero con especias moriscas" }
          ]
        },
        {
          name: "Sweets & Drinks",
          name_target: "Dulces y Bebidas",
          items: [
            { name: "Turrón", name_target: "Turrón de Jijona", price: "€3.00", description_target: "Turrón blando de almendra tradicional" },
            { name: "Sangría", name_target: "Sangría casera", price: "€3.50", description_target: "Sangría con vino tinto, frutas de temporada y un toque de brandy" },
            { name: "Horchata", name_target: "Horchata valenciana", price: "€3.00", description_target: "Bebida refrescante de chufa con fartons" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Street Food",
          name_target: "Comida Callejera",
          items: [
            { name: "Pulpo a Feira", name_target: "Pulpo á feira", price: "€7.00", description_target: "Pulpo cocido al estilo gallego sobre tabla de madera con pimentón de la Vera, sal gruesa y aceite de oliva virgen extra" },
            { name: "Paella in Cone", name_target: "Cono de paella", price: "€5.00", description_target: "Paella valenciana de pollo y verduras servida en cono de papel para comer andando" },
            { name: "Croquettes", name_target: "Croquetas artesanas", price: "€4.00", description_target: "Croquetas caseras de jamón ibérico con bechamel cremosa, receta de la abuela" },
            { name: "Mini Tortilla", name_target: "Pincho de tortilla", price: "€3.50", description_target: "Porción de tortilla española de patata con cebolla caramelizada sobre rebanada de pan" },
            { name: "Boquerones", name_target: "Boquerones en vinagre", price: "€5.00", description_target: "Boquerones frescos marinados en vinagre, ajo y perejil, servidos con aceituna" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "Parrilla y Brasas",
          items: [
            { name: "Grilled Sardines", name_target: "Espeto de sardinas", price: "€6.00", description_target: "Sardinas ensartadas en cañas y asadas a la brasa de leña de olivo, estilo malagueño" },
            { name: "Lamb Chops", name_target: "Chuletillas de cordero al sarmiento", price: "€8.00", description_target: "Chuletillas de cordero lechal asadas sobre sarmientos de vid, sal y nada más" },
            { name: "Grilled Vegetables", name_target: "Calçots a la brasa", price: "€6.00", description_target: "Calçots catalanes asados a la brasa con salsa romesco tradicional" },
            { name: "Pork Loin Sandwich", name_target: "Pepito de ternera", price: "€5.50", description_target: "Filete de ternera a la plancha en pan crujiente con pimientos del padrón" }
          ]
        },
        {
          name: "Sweets",
          name_target: "Dulces",
          items: [
            { name: "Churros with Chocolate", name_target: "Churros con chocolate artesano", price: "€5.00", description_target: "Churros recién fritos con chocolate espeso a la taza, elaborado con cacao de origen" },
            { name: "Buñuelos", name_target: "Buñuelos de viento", price: "€3.50", description_target: "Buñuelos esponjosos espolvoreados con azúcar y canela, receta de las fiestas" },
            { name: "Turrón", name_target: "Turrón artesano de Jijona y Alicante", price: "€4.00", description_target: "Turrón blando de Jijona y duro de Alicante, elaborado con almendra marcona" },
            { name: "Crema Catalana", name_target: "Crema catalana en vasito", price: "€3.50", description_target: "Vasito de crema catalana con azúcar caramelizado al soplete" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Bebidas",
          items: [
            { name: "Sangría", name_target: "Sangría artesanal", price: "€4.00", description_target: "Sangría elaborada con vino tinto de la tierra, frutas de temporada, brandy y un toque de canela" },
            { name: "Tinto de Verano", name_target: "Tinto de verano", price: "€3.00", description_target: "Vino tinto con gaseosa de limón, la bebida más refrescante de las fiestas de verano" },
            { name: "Cider", name_target: "Sidra natural asturiana", price: "€3.50", description_target: "Sidra natural escenciada al estilo tradicional asturiano, servida desde altura" },
            { name: "Agua de Valencia", name_target: "Agua de Valencia", price: "€5.00", description_target: "Cóctel valenciano de cava, zumo de naranja, vodka y ginebra, servido bien frío" }
          ]
        }
      ]
    }
  },
  french: {
    beginner: {
      sections: [
        {
          name: "Street Food",
          name_target: "Restauration Rapide",
          items: [
            { name: "Crêpe", name_target: "Crêpe au sucre", price: "€3.50", description_target: "Crêpe avec sucre et beurre" },
            { name: "Croque-Monsieur", name_target: "Croque-monsieur", price: "€5.00", description_target: "Sandwich chaud au jambon et fromage" },
            { name: "Frites", name_target: "Cornet de frites", price: "€3.00", description_target: "Frites croustillantes avec mayonnaise" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Boissons",
          items: [
            { name: "Hot Cider", name_target: "Cidre chaud", price: "€3.00", description_target: "Cidre chaud aux épices" },
            { name: "Hot Chocolate", name_target: "Chocolat chaud", price: "€3.50", description_target: "Chocolat chaud crémeux" },
            { name: "Lemonade", name_target: "Citronnade", price: "€2.50", description_target: "Citronnade fraîche maison" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Street Food",
          name_target: "Restauration de Rue",
          items: [
            { name: "Galette", name_target: "Galette complète", price: "€6.00", description_target: "Galette bretonne au sarrasin avec jambon, fromage et œuf" },
            { name: "Merguez Sandwich", name_target: "Merguez-frites", price: "€5.50", description_target: "Saucisse merguez grillée dans un pain avec moutarde et frites" },
            { name: "Quiche Lorraine", name_target: "Part de quiche Lorraine", price: "€4.50", description_target: "Quiche traditionnelle aux lardons et crème fraîche" },
            { name: "Tartiflette", name_target: "Tartiflette savoyarde", price: "€7.00", description_target: "Gratin de pommes de terre au reblochon avec lardons et oignons" }
          ]
        },
        {
          name: "Sweets",
          name_target: "Sucreries",
          items: [
            { name: "Crêpe Nutella", name_target: "Crêpe au Nutella", price: "€4.50", description_target: "Crêpe garnie de Nutella et banane avec chantilly" },
            { name: "Gaufre", name_target: "Gaufre liégeoise", price: "€4.00", description_target: "Gaufre chaude au sucre perlé avec chantilly" },
            { name: "Choux à la Crème", name_target: "Choux à la crème", price: "€3.50", description_target: "Choux fourrés de crème pâtissière à la vanille" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Boissons",
          items: [
            { name: "Vin Chaud", name_target: "Vin chaud", price: "€4.00", description_target: "Vin rouge chaud aux épices de Noël, cannelle et orange" },
            { name: "Cider", name_target: "Cidre breton", price: "€3.50", description_target: "Cidre artisanal brut de Bretagne" },
            { name: "Pastis", name_target: "Pastis", price: "€4.00", description_target: "Pastis provençal avec carafe d'eau fraîche" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Street Food",
          name_target: "Restauration de Rue",
          items: [
            { name: "Galette Complète", name_target: "Galette complète bretonne", price: "€7.00", description_target: "Galette de blé noir bretonne garnie de jambon artisanal, emmental râpé et œuf fermier, pliée à la main" },
            { name: "Duck Confit Fries", name_target: "Confit de canard et frites", price: "€9.00", description_target: "Effiloché de confit de canard du Sud-Ouest sur lit de frites croustillantes avec salade et vinaigrette à la truffe" },
            { name: "Provençal Socca", name_target: "Socca niçoise", price: "€4.00", description_target: "Galette croustillante de farine de pois chiches cuite au feu de bois, spécialité de la cuisine niçoise" },
            { name: "Raclette Sandwich", name_target: "Sandwich raclette", price: "€6.50", description_target: "Pain de campagne avec fromage à raclette fondu, charcuterie savoyarde et cornichons" },
            { name: "Oysters", name_target: "Huîtres de Cancale", price: "€12.00", description_target: "Six huîtres plates de Cancale servies sur glace pilée avec citron et échalote au vinaigre de vin rouge" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "Grillades",
          items: [
            { name: "Merguez Platter", name_target: "Assiette de merguez grillées", price: "€8.00", description_target: "Merguez artisanales grillées au feu de bois avec couscous aux légumes grillés et harissa maison" },
            { name: "Andouillette", name_target: "Andouillette grillée", price: "€9.00", description_target: "Andouillette de Troyes certifiée AAAAA grillée à la moutarde de Dijon avec pommes de terre grenaille" },
            { name: "Grilled Sausage", name_target: "Saucisse de Morteau grillée", price: "€7.50", description_target: "Saucisse de Morteau fumée au bois de résineux, grillée et servie avec salade de pommes de terre" },
            { name: "Brochettes", name_target: "Brochettes de poulet marinées", price: "€7.00", description_target: "Brochettes de poulet fermier marinées aux herbes de Provence et citron, grillées au charbon" }
          ]
        },
        {
          name: "Sweets",
          name_target: "Sucreries et Pâtisseries",
          items: [
            { name: "Crêpe Suzette", name_target: "Crêpe Suzette", price: "€6.00", description_target: "Crêpe flambée au Grand Marnier avec beurre d'orange et zeste de citron, préparée devant vous" },
            { name: "Tarte aux Fraises", name_target: "Tarte aux fraises de Plougastel", price: "€5.00", description_target: "Tarte sablée avec crème pâtissière et fraises fraîches de Plougastel" },
            { name: "Nougat", name_target: "Nougat de Montélimar", price: "€4.00", description_target: "Nougat artisanal aux amandes, pistaches et miel de lavande de Provence" },
            { name: "Calisson", name_target: "Calissons d'Aix", price: "€5.00", description_target: "Confiserie provençale traditionnelle à la pâte d'amande et melon confit, glaçage au sucre royal" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Boissons",
          items: [
            { name: "Vin Chaud", name_target: "Vin chaud aux épices", price: "€5.00", description_target: "Vin rouge de Bordeaux chauffé avec cannelle, clou de girofle, anis étoilé, zeste d'orange et miel" },
            { name: "Calvados", name_target: "Calvados normand", price: "€6.00", description_target: "Eau-de-vie de pomme vieillie en fût de chêne, digestif traditionnel normand" },
            { name: "Kir Royal", name_target: "Kir royal", price: "€7.00", description_target: "Coupe de crémant de Bourgogne avec liqueur de cassis de Dijon" },
            { name: "Cidre Bouché", name_target: "Cidre bouché breton", price: "€4.00", description_target: "Cidre fermier bouché de Cornouaille, naturellement pétillant et fruité" }
          ]
        }
      ]
    }
  },
  german: {
    beginner: {
      sections: [
        {
          name: "Street Food",
          name_target: "Straßenessen",
          items: [
            { name: "Bratwurst", name_target: "Bratwurst", price: "€3.50", description_target: "Gebratene Bratwurst im Brötchen" },
            { name: "Pretzel", name_target: "Brezel", price: "€2.50", description_target: "Frische Brezel mit Butter" },
            { name: "Currywurst", name_target: "Currywurst", price: "€4.00", description_target: "Bratwurst mit Currysoße und Pommes" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Getränke",
          items: [
            { name: "Beer", name_target: "Bier", price: "€4.00", description_target: "Frisches Bier vom Fass" },
            { name: "Hot Chocolate", name_target: "Heiße Schokolade", price: "€3.50", description_target: "Warme Schokolade mit Sahne" },
            { name: "Apple Juice", name_target: "Apfelsaft", price: "€2.50", description_target: "Frischer Apfelsaft" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Street Food",
          name_target: "Straßenessen",
          items: [
            { name: "Currywurst", name_target: "Berliner Currywurst", price: "€4.50", description_target: "Original Berliner Currywurst mit hausgemachter Currysoße und knusprigen Pommes" },
            { name: "Flammkuchen", name_target: "Elsässer Flammkuchen", price: "€5.00", description_target: "Dünner Flammkuchen mit Crème fraîche, Speck und Zwiebeln" },
            { name: "Leberkäse", name_target: "Leberkäsesemmel", price: "€4.00", description_target: "Warmer Leberkäse im Brötchen mit süßem Senf" },
            { name: "Kartoffelpuffer", name_target: "Kartoffelpuffer", price: "€4.00", description_target: "Knusprige Reibekuchen mit Apfelmus" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "Vom Grill",
          items: [
            { name: "Thüringer Bratwurst", name_target: "Thüringer Rostbratwurst", price: "€4.50", description_target: "Traditionelle Thüringer Bratwurst vom Holzkohlegrill mit Senf" },
            { name: "Grilled Chicken", name_target: "Halbes Brathähnchen", price: "€7.00", description_target: "Knuspriges halbes Brathähnchen vom Drehspieß" },
            { name: "Steckerlfisch", name_target: "Steckerlfisch", price: "€8.00", description_target: "Makrele am Holzspieß über dem Feuer gegrillt" }
          ]
        },
        {
          name: "Sweets & Drinks",
          name_target: "Süßes und Getränke",
          items: [
            { name: "Gebrannte Mandeln", name_target: "Gebrannte Mandeln", price: "€4.00", description_target: "Frisch gebrannte Mandeln mit Zimt und Zucker" },
            { name: "Glühwein", name_target: "Glühwein", price: "€4.00", description_target: "Heißer Rotwein mit Gewürzen und Orangenschale" },
            { name: "Dampfnudel", name_target: "Dampfnudel", price: "€4.50", description_target: "Gedämpfter Hefekloß mit Vanillesoße" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Street Food",
          name_target: "Straßenessen",
          items: [
            { name: "Currywurst", name_target: "Berliner Currywurst", price: "€5.00", description_target: "Original Berliner Currywurst vom Konnopke mit hausgemachter scharfer Currysoße und knusprigen Pommes frites" },
            { name: "Flammkuchen", name_target: "Elsässer Flammkuchen", price: "€6.00", description_target: "Hauchdünner Flammkuchen aus dem Holzofen mit Crème fraîche, geräuchertem Speck und karamellisierten Zwiebeln" },
            { name: "Maultaschen", name_target: "Schwäbische Maultaschen", price: "€5.50", description_target: "Handgemachte schwäbische Maultaschen geschmälzt mit Röstzwiebeln und Kartoffelsalat" },
            { name: "Labskaus", name_target: "Hamburger Labskaus", price: "€7.00", description_target: "Norddeutsches Seemannsgericht aus Corned Beef, Kartoffeln und Roter Bete mit Rollmops und Spiegelei" },
            { name: "Zwiebelkuchen", name_target: "Schwäbischer Zwiebelkuchen", price: "€4.50", description_target: "Herzhafter Zwiebelkuchen mit Speck und Kümmel, traditionell zum Federweißen serviert" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "Vom Grill und aus dem Ofen",
          items: [
            { name: "Nürnberger Bratwurst", name_target: "Nürnberger Rostbratwürstchen", price: "€6.00", description_target: "Sechs Original Nürnberger Rostbratwürstchen auf Sauerkraut vom Buchenholzgrill mit fränkischem Senf" },
            { name: "Schweinshaxe", name_target: "Bayerische Schweinshaxe", price: "€12.00", description_target: "Knusprig gebratene Schweinshaxe mit Kruste, serviert mit Kartoffelknödeln und Krautsalat" },
            { name: "Flammlachs", name_target: "Flammlachs", price: "€9.00", description_target: "Frisches Lachsfilet am Brett über dem offenen Feuer gegrillt nach skandinavischer Art" },
            { name: "Pulled Pork", name_target: "Pulled Pork im Brötchen", price: "€7.00", description_target: "Zwölf Stunden über Buchenholz geräuchertes Schweinefleisch im Brioche-Brötchen mit Coleslaw" }
          ]
        },
        {
          name: "Sweets",
          name_target: "Süßes",
          items: [
            { name: "Gebrannte Mandeln", name_target: "Gebrannte Mandeln", price: "€5.00", description_target: "Frisch im Kupferkessel gebrannte Mandeln mit Zimt und braunem Zucker nach altem Jahrmarktsrezept" },
            { name: "Baumstriezel", name_target: "Baumstriezel", price: "€5.00", description_target: "Über Holzkohle gedrehter Hefeteig mit Zimt-Zucker-Kruste, eine siebenbürgische Spezialität" },
            { name: "Quarkbällchen", name_target: "Quarkbällchen", price: "€4.00", description_target: "Goldbraun ausgebackene Quarkbällchen mit Puderzucker bestäubt, nach Großmutters Rezept" },
            { name: "Lebkuchen", name_target: "Nürnberger Lebkuchen", price: "€4.50", description_target: "Oblatenlebkuchen aus Nürnberg mit Nüssen, Honig und weihnachtlichen Gewürzen, mit Schokoladenglasur" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Getränke",
          items: [
            { name: "Glühwein", name_target: "Fränkischer Glühwein", price: "€4.50", description_target: "Heißer Rotwein vom fränkischen Winzer mit Nelken, Zimt, Sternanis und Orangenschale" },
            { name: "Feuerzangenbowle", name_target: "Feuerzangenbowle", price: "€6.00", description_target: "Flambierter Rotweinpunsch mit Rum-getränktem Zuckerhut, ein festliches Schauspiel" },
            { name: "Federweißer", name_target: "Federweißer", price: "€4.00", description_target: "Junger, noch gärender Traubenmost aus der aktuellen Lese, trüb und süffig" },
            { name: "Eierpunsch", name_target: "Eierpunsch", price: "€5.00", description_target: "Wärmender Punsch aus Ei, Zucker, Weißwein und Vanille mit einer Sahnehaube" }
          ]
        }
      ]
    }
  },
  italian: {
    beginner: {
      sections: [
        {
          name: "Street Food",
          name_target: "Cibo di Strada",
          items: [
            { name: "Arancini", name_target: "Arancini", price: "€3.00", description_target: "Palle di riso fritte con ragù" },
            { name: "Pizza Slice", name_target: "Trancio di pizza", price: "€3.50", description_target: "Trancio di pizza margherita" },
            { name: "Panini", name_target: "Panino con prosciutto", price: "€4.00", description_target: "Panino con prosciutto e mozzarella" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Bevande",
          items: [
            { name: "Espresso", name_target: "Caffè espresso", price: "€1.50", description_target: "Caffè espresso italiano" },
            { name: "Lemonade", name_target: "Limonata", price: "€2.50", description_target: "Limonata fresca con limoni di Sorrento" },
            { name: "Prosecco", name_target: "Prosecco", price: "€4.00", description_target: "Calice di Prosecco fresco" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Street Food",
          name_target: "Cibo di Strada",
          items: [
            { name: "Arancini", name_target: "Arancini al ragù", price: "€3.50", description_target: "Arancini siciliani ripieni di ragù di carne, piselli e mozzarella" },
            { name: "Porchetta Sandwich", name_target: "Panino con porchetta", price: "€5.00", description_target: "Panino croccante farcito con porchetta arrosto con erbe e finocchio" },
            { name: "Supplì", name_target: "Supplì al telefono", price: "€2.50", description_target: "Crocchette di riso romane con mozzarella filante all'interno" },
            { name: "Focaccia", name_target: "Focaccia di Recco", price: "€4.00", description_target: "Focaccia ligure sottile ripiena di formaggio stracchino" }
          ]
        },
        {
          name: "Grilled & Fried",
          name_target: "Fritti e Grigliati",
          items: [
            { name: "Fried Seafood", name_target: "Frittura di pesce", price: "€8.00", description_target: "Misto di calamari, gamberi e pesciolini fritti con limone" },
            { name: "Lampredotto", name_target: "Lampredotto", price: "€5.00", description_target: "Trippa di manzo bollita nel brodo servita nel panino, specialità fiorentina" },
            { name: "Bombette", name_target: "Bombette pugliesi", price: "€6.00", description_target: "Involtini di carne alla brace ripieni di formaggio, specialità pugliese" }
          ]
        },
        {
          name: "Sweets & Drinks",
          name_target: "Dolci e Bevande",
          items: [
            { name: "Gelato", name_target: "Gelato artigianale", price: "€3.50", description_target: "Due gusti di gelato artigianale in coppetta" },
            { name: "Cannolo", name_target: "Cannolo siciliano", price: "€3.00", description_target: "Cannolo croccante con ricotta dolce e pistacchio" },
            { name: "Spritz", name_target: "Aperol Spritz", price: "€5.00", description_target: "Aperol con Prosecco e seltz, il classico aperitivo veneto" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Street Food",
          name_target: "Cibo di Strada",
          items: [
            { name: "Arancini", name_target: "Arancini siciliani", price: "€4.00", description_target: "Arancini fritti dorati ripieni di ragù alla siciliana con piselli, mozzarella e una punta di zafferano" },
            { name: "Porchetta Sandwich", name_target: "Panino con porchetta di Ariccia", price: "€6.00", description_target: "Fette di porchetta IGP di Ariccia arrosto con erbe aromatiche e finocchio selvatico nel pane casereccio" },
            { name: "Piadina", name_target: "Piadina romagnola", price: "€5.00", description_target: "Piadina romagnola IGP farcita con squacquerone di Romagna, rucola selvatica e prosciutto di Parma" },
            { name: "Cuoppo", name_target: "Cuoppo napoletano", price: "€5.50", description_target: "Cono di carta ripieno di fritture miste napoletane: zeppoline, crocchè, arancini e frittatine di pasta" },
            { name: "Lampredotto", name_target: "Lampredotto fiorentino", price: "€5.50", description_target: "Trippa di manzo bollita nel brodo aromatico con salsa verde e peperoncino, nel panino toscano bagnato nel brodo" }
          ]
        },
        {
          name: "Grilled & Fried",
          name_target: "Grigliati e Fritti",
          items: [
            { name: "Grilled Sausage", name_target: "Salsiccia alla brace con friarielli", price: "€7.00", description_target: "Salsiccia di suino campano alla brace servita con friarielli saltati all'aglio e peperoncino" },
            { name: "Bombette", name_target: "Bombette pugliesi alla brace", price: "€7.00", description_target: "Involtini di capocollo di maiale ripieni di canestrato pugliese e prezzemolo, cotti sulla brace di ulivo" },
            { name: "Fritto Misto di Mare", name_target: "Gran fritto misto di mare", price: "€10.00", description_target: "Frittura leggera di calamari, gamberi rossi, alici e zucchine in pastella croccante con limone" },
            { name: "Stigghiola", name_target: "Stigghiola palermitana", price: "€5.00", description_target: "Intestino d'agnello avvolto attorno al cipollotto e grigliato alla brace, antico cibo di strada palermitano" }
          ]
        },
        {
          name: "Sweets",
          name_target: "Dolci",
          items: [
            { name: "Gelato", name_target: "Gelato artigianale di Sicilia", price: "€4.50", description_target: "Tre gusti di gelato artigianale: pistacchio di Bronte, mandorla di Avola e cioccolato di Modica" },
            { name: "Sfogliatella", name_target: "Sfogliatella napoletana", price: "€3.50", description_target: "Sfogliatella riccia con ricotta, semolino e canditi, appena sfornata dalla pasticceria" },
            { name: "Granita", name_target: "Granita siciliana con brioche", price: "€4.00", description_target: "Granita di mandorla o gelso nero con brioche col tuppo, la colazione estiva siciliana" },
            { name: "Zeppole", name_target: "Zeppole di San Giuseppe", price: "€3.00", description_target: "Zeppole fritte di pasta choux ripiene di crema pasticciera e amarena, dolce tradizionale della festa" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Bevande",
          items: [
            { name: "Spritz", name_target: "Spritz veneziano", price: "€5.50", description_target: "Aperol con Prosecco di Valdobbiadene e una spruzzata di seltz, servito con oliva e fetta d'arancia" },
            { name: "Limoncello", name_target: "Limoncello della Costiera", price: "€4.00", description_target: "Limoncello artigianale di limoni della Costiera Amalfitana, servito ghiacciato in bicchierino di ceramica" },
            { name: "Negroni Sbagliato", name_target: "Negroni sbagliato", price: "€6.00", description_target: "Variante milanese del Negroni con Prosecco al posto del gin, Campari e vermut rosso" },
            { name: "Local Wine", name_target: "Vino locale sfuso", price: "€3.00", description_target: "Bicchiere di vino rosso o bianco della cantina locale, servito nel bicchiere di carta alla sagra" }
          ]
        }
      ]
    }
  },
  portuguese: {
    beginner: {
      sections: [
        {
          name: "Street Food",
          name_target: "Comida de Rua",
          items: [
            { name: "Pastel de Nata", name_target: "Pastel de nata", price: "R$8.00", description_target: "Pastel de nata quentinho" },
            { name: "Coxinha", name_target: "Coxinha", price: "R$7.00", description_target: "Coxinha de frango cremosa" },
            { name: "Pão de Queijo", name_target: "Pão de queijo", price: "R$5.00", description_target: "Pão de queijo mineiro" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Bebidas",
          items: [
            { name: "Coconut Water", name_target: "Água de coco", price: "R$8.00", description_target: "Água de coco natural gelada" },
            { name: "Guaraná", name_target: "Guaraná", price: "R$6.00", description_target: "Refrigerante de guaraná" },
            { name: "Beer", name_target: "Cerveja", price: "R$8.00", description_target: "Cerveja gelada" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Street Food",
          name_target: "Comida de Rua",
          items: [
            { name: "Acarajé", name_target: "Acarajé", price: "R$12.00", description_target: "Bolinho de feijão frito recheado com vatapá e camarão seco" },
            { name: "Tapioca", name_target: "Tapioca", price: "R$10.00", description_target: "Tapioca recheada com queijo coalho e carne de sol" },
            { name: "Espetinho", name_target: "Espetinho", price: "R$8.00", description_target: "Espetinho de carne bovina com farofa e vinagrete" },
            { name: "Pastel", name_target: "Pastel de feira", price: "R$9.00", description_target: "Pastel frito crocante com recheio de carne moída" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "Churrasquinho",
          items: [
            { name: "Grilled Cheese", name_target: "Queijo coalho", price: "R$8.00", description_target: "Queijo coalho grelhado com melado de cana" },
            { name: "Chicken Hearts", name_target: "Coração de frango", price: "R$10.00", description_target: "Espetinho de coração de frango temperado com limão e sal" },
            { name: "Linguiça", name_target: "Linguiça toscana", price: "R$12.00", description_target: "Linguiça toscana grelhada com farofa e pão" }
          ]
        },
        {
          name: "Sweets & Drinks",
          name_target: "Doces e Bebidas",
          items: [
            { name: "Brigadeiro", name_target: "Brigadeiro gourmet", price: "R$6.00", description_target: "Brigadeiro de chocolate belga com granulado" },
            { name: "Caipirinha", name_target: "Caipirinha", price: "R$15.00", description_target: "Caipirinha de cachaça artesanal com limão" },
            { name: "Açaí", name_target: "Açaí na tigela", price: "R$18.00", description_target: "Açaí cremoso com banana, granola e mel" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Street Food",
          name_target: "Comida de Rua",
          items: [
            { name: "Acarajé", name_target: "Acarajé baiano", price: "R$15.00", description_target: "Bolinho de feijão-fradinho frito no azeite de dendê, recheado com vatapá, caruru, camarão seco e pimenta" },
            { name: "Tapioca Gourmet", name_target: "Tapioca gourmet", price: "R$14.00", description_target: "Tapioca nordestina com recheio de carne de sol desfiada, queijo coalho derretido e manteiga de garrafa" },
            { name: "Pastel de Bacalhau", name_target: "Pastel de bacalhau", price: "R$12.00", description_target: "Pastel crocante recheado com bacalhau desfiado, batata e azeitonas pretas, frito na hora" },
            { name: "Coxinha Gourmet", name_target: "Coxinha cremosa", price: "R$10.00", description_target: "Coxinha artesanal de frango caipira desfiado com catupiry original, massa crocante por fora" },
            { name: "Bauru", name_target: "Bauru paulista", price: "R$16.00", description_target: "Sanduíche paulista clássico com rosbife, queijo derretido, tomate e picles no pão francês" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "Churrasquinho de Rua",
          items: [
            { name: "Picanha Skewer", name_target: "Espetinho de picanha", price: "R$18.00", description_target: "Espetinho de picanha na brasa com farofa de manteiga, vinagrete e farinha" },
            { name: "Grilled Cheese", name_target: "Queijo coalho na brasa", price: "R$10.00", description_target: "Queijo coalho nordestino grelhado no espeto com melado de cana-de-açúcar ou orégano" },
            { name: "Kafta", name_target: "Kafta no espeto", price: "R$14.00", description_target: "Espetinho de kafta de carne bovina temperada com hortelã, cebola e especiarias árabes" },
            { name: "Sausage Skewer", name_target: "Linguiça artesanal na brasa", price: "R$12.00", description_target: "Linguiça artesanal de porco grelhada lentamente na brasa, servida com pão e mostarda" }
          ]
        },
        {
          name: "Sweets",
          name_target: "Doces",
          items: [
            { name: "Brigadeiro Gourmet", name_target: "Brigadeiro gourmet", price: "R$8.00", description_target: "Brigadeiro artesanal de chocolate belga 70% cacau com granulado crocante, feito com leite condensado caseiro" },
            { name: "Churros", name_target: "Churros recheado", price: "R$12.00", description_target: "Churros crocante recheado com doce de leite artesanal ou chocolate meio amargo" },
            { name: "Cocada", name_target: "Cocada baiana", price: "R$6.00", description_target: "Cocada artesanal com coco fresco ralado, açúcar e leite condensado, receita da Bahia" },
            { name: "Açaí Bowl", name_target: "Açaí na tigela completo", price: "R$22.00", description_target: "Açaí puro do Pará batido com guaraná, coberto com banana, morango, granola, leite condensado e mel" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Bebidas",
          items: [
            { name: "Caipirinha", name_target: "Caipirinha de cachaça artesanal", price: "R$18.00", description_target: "Caipirinha preparada com cachaça artesanal envelhecida de Minas Gerais, limão tahiti e açúcar demerara" },
            { name: "Quentão", name_target: "Quentão de festa junina", price: "R$10.00", description_target: "Bebida quente de cachaça com gengibre, cravo, canela e casca de laranja, tradição das festas juninas" },
            { name: "Caldo de Cana", name_target: "Caldo de cana", price: "R$8.00", description_target: "Caldo de cana-de-açúcar extraído na hora, gelado com limão" },
            { name: "Batida", name_target: "Batida de coco", price: "R$16.00", description_target: "Batida cremosa de leite de coco com cachaça artesanal e leite condensado, gelada" }
          ]
        }
      ]
    }
  },
  japanese: {
    beginner: {
      sections: [
        {
          name: "Street Food",
          name_target: "屋台料理",
          items: [
            { name: "Takoyaki", name_target: "たこ焼き", price: "¥500", description_target: "タコ入りの丸い焼き菓子" },
            { name: "Yakitori", name_target: "焼き鳥", price: "¥400", description_target: "鶏肉の串焼き" },
            { name: "Okonomiyaki", name_target: "お好み焼き", price: "¥600", description_target: "野菜と肉の日本風お好み焼き" }
          ]
        },
        {
          name: "Drinks",
          name_target: "飲み物",
          items: [
            { name: "Ramune", name_target: "ラムネ", price: "¥200", description_target: "日本の炭酸飲料" },
            { name: "Green Tea", name_target: "緑茶", price: "¥150", description_target: "冷たい緑茶" },
            { name: "Beer", name_target: "生ビール", price: "¥500", description_target: "冷たい生ビール" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Street Food",
          name_target: "屋台料理",
          items: [
            { name: "Takoyaki", name_target: "たこ焼き", price: "¥600", description_target: "大阪名物のたこ焼き、ソースとマヨネーズかつお節添え" },
            { name: "Yakisoba", name_target: "焼きそば", price: "¥550", description_target: "豚肉と野菜の焼きそば、紅しょうが添え" },
            { name: "Ikayaki", name_target: "イカ焼き", price: "¥500", description_target: "まるごとイカの醤油焼き" },
            { name: "Karaage", name_target: "唐揚げ", price: "¥500", description_target: "にんにく醤油味の鶏の唐揚げ" }
          ]
        },
        {
          name: "Festival Treats",
          name_target: "お祭りのお菓子",
          items: [
            { name: "Cotton Candy", name_target: "わたあめ", price: "¥300", description_target: "ふわふわのわたあめ" },
            { name: "Candied Apple", name_target: "りんご飴", price: "¥400", description_target: "赤いりんご飴" },
            { name: "Chocolate Banana", name_target: "チョコバナナ", price: "¥350", description_target: "チョコレートでコーティングしたバナナ" }
          ]
        },
        {
          name: "Drinks",
          name_target: "飲み物",
          items: [
            { name: "Ramune", name_target: "ラムネ", price: "¥250", description_target: "ビー玉入りの日本の炭酸飲料、いちご味やメロン味も" },
            { name: "Kakigori", name_target: "かき氷", price: "¥400", description_target: "削った氷にシロップをかけた夏の定番" },
            { name: "Amazake", name_target: "甘酒", price: "¥300", description_target: "米麹から作る甘い伝統的な飲み物" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Street Food",
          name_target: "屋台料理",
          items: [
            { name: "Takoyaki", name_target: "大阪たこ焼き", price: "¥700", description_target: "大阪道頓堀の名物たこ焼き、外はカリカリ中はとろとろ、特製ソースとマヨネーズにかつお節と青のり" },
            { name: "Hiroshima Okonomiyaki", name_target: "広島風お好み焼き", price: "¥800", description_target: "キャベツ、もやし、豚肉、焼きそばを重ねた広島伝統のお好み焼き、目玉焼きのせ" },
            { name: "Ikayaki", name_target: "姿焼きイカ", price: "¥600", description_target: "新鮮なイカをまるごと一杯、炭火で豪快に焼き上げた屋台の定番" },
            { name: "Jaga-Bata", name_target: "じゃがバター", price: "¥400", description_target: "北海道産男爵いもをホクホクに蒸して、バターと塩辛をのせた屋台の人気メニュー" },
            { name: "Monjayaki", name_target: "もんじゃ焼き", price: "¥700", description_target: "東京下町名物のもんじゃ焼き、小さなヘラで鉄板からこそげて食べる月島スタイル" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "焼き物",
          items: [
            { name: "Premium Yakitori Set", name_target: "焼き鳥盛り合わせ", price: "¥1200", description_target: "ねぎま、つくね、皮、レバー、ぼんじりの五種盛り、備長炭で丁寧に焼き上げ" },
            { name: "Wagyu Skewer", name_target: "和牛串", price: "¥800", description_target: "A4ランク和牛のサイコロステーキを串に刺して炭火焼き、わさび塩で" },
            { name: "Grilled Corn", name_target: "焼きとうもろこし", price: "¥400", description_target: "北海道産とうもろこしを炭火で焼き上げ、醤油を塗って香ばしく仕上げた夏の味覚" },
            { name: "Ayu Fish", name_target: "鮎の塩焼き", price: "¥600", description_target: "清流育ちの天然鮎を丸ごと串に刺し、塩をふって炭火でじっくり焼いた夏の風物詩" }
          ]
        },
        {
          name: "Sweets",
          name_target: "甘味",
          items: [
            { name: "Candied Apple", name_target: "りんご飴", price: "¥500", description_target: "青森産ふじりんごを飴でコーティング、パリパリの飴と甘酸っぱいりんごのハーモニー" },
            { name: "Dango", name_target: "みたらし団子", price: "¥350", description_target: "もちもちの団子に甘辛い醤油だれを絡めた京都の伝統的な和菓子" },
            { name: "Taiyaki", name_target: "たい焼き", price: "¥250", description_target: "鯛の形をしたカリカリの生地に北海道産小豆のつぶあんをたっぷり詰めた焼き菓子" },
            { name: "Kakigori", name_target: "天然氷のかき氷", price: "¥700", description_target: "日光の天然氷を薄く削り、自家製宇治抹茶シロップと練乳をかけた贅沢なかき氷" }
          ]
        },
        {
          name: "Drinks",
          name_target: "飲み物",
          items: [
            { name: "Festival Sake", name_target: "お祭り限定日本酒", price: "¥600", description_target: "地元酒蔵の祭り限定純米吟醸、升酒スタイルで粗塩を添えて" },
            { name: "Ramune", name_target: "ラムネ各種", price: "¥250", description_target: "ビー玉栓の懐かしいラムネ、オリジナル・メロン・いちご味からお選びください" },
            { name: "Amazake", name_target: "手作り甘酒", price: "¥350", description_target: "地元の麹屋が作る無添加の生甘酒、ノンアルコールで栄養豊富な日本の伝統飲料" },
            { name: "Chuhai", name_target: "生レモンサワー", price: "¥500", description_target: "瀬戸内レモンを丸ごと搾った生レモンサワー、すっきり爽やかな屋台の定番" }
          ]
        }
      ]
    }
  },
  mandarin: {
    beginner: {
      sections: [
        {
          name: "Street Food",
          name_target: "街头小吃",
          items: [
            { name: "Jianbing", name_target: "煎饼果子", price: "¥8", description_target: "鸡蛋煎饼配薄脆" },
            { name: "Meat Skewers", name_target: "羊肉串", price: "¥5", description_target: "烤羊肉串配孜然" },
            { name: "Steamed Buns", name_target: "小笼包", price: "¥15", description_target: "鲜肉小笼包" }
          ]
        },
        {
          name: "Drinks",
          name_target: "饮品",
          items: [
            { name: "Bubble Tea", name_target: "珍珠奶茶", price: "¥12", description_target: "奶茶配珍珠" },
            { name: "Soy Milk", name_target: "豆浆", price: "¥5", description_target: "热豆浆" },
            { name: "Plum Juice", name_target: "酸梅汤", price: "¥6", description_target: "冰镇酸梅汤" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Street Food",
          name_target: "街头小吃",
          items: [
            { name: "Jianbing", name_target: "煎饼果子", price: "¥10", description_target: "天津传统煎饼果子，鸡蛋、薄脆、甜面酱和辣酱" },
            { name: "Roujiamo", name_target: "肉夹馍", price: "¥12", description_target: "西安传统肉夹馍，酥脆白吉馍夹卤肉" },
            { name: "Stinky Tofu", name_target: "臭豆腐", price: "¥10", description_target: "长沙风味炸臭豆腐配辣椒酱和香菜" },
            { name: "Scallion Pancake", name_target: "葱油饼", price: "¥8", description_target: "酥脆的上海葱油饼，层次分明" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "烧烤",
          items: [
            { name: "Lamb Skewers", name_target: "烤羊肉串", price: "¥6", description_target: "新疆风味羊肉串配孜然和辣椒面" },
            { name: "Grilled Chicken Wings", name_target: "烤鸡翅", price: "¥8", description_target: "炭火烤鸡翅配秘制酱料" },
            { name: "Grilled Eggplant", name_target: "烤茄子", price: "¥12", description_target: "烤茄子配蒜蓉和辣椒" }
          ]
        },
        {
          name: "Sweets & Drinks",
          name_target: "甜品饮品",
          items: [
            { name: "Candied Hawthorn", name_target: "糖葫芦", price: "¥8", description_target: "冰糖裹山楂串，酸甜可口" },
            { name: "Bubble Tea", name_target: "珍珠奶茶", price: "¥15", description_target: "手工现煮珍珠搭配鲜奶茶" },
            { name: "Douhua", name_target: "豆花", price: "¥8", description_target: "嫩滑豆花配红糖浆和花生碎" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Street Food",
          name_target: "街头小吃",
          items: [
            { name: "Jianbing", name_target: "天津煎饼果子", price: "¥12", description_target: "正宗天津煎饼果子，绿豆面糊摊出薄饼，加鸡蛋、薄脆、葱花，刷甜面酱和辣酱" },
            { name: "Roujiamo", name_target: "西安腊汁肉夹馍", price: "¥15", description_target: "百年老字号腊汁肉夹馍，精选五花肉用三十多种香料慢炖至酥烂，夹入现烤白吉馍中" },
            { name: "Stinky Tofu", name_target: "长沙臭豆腐", price: "¥12", description_target: "正宗长沙火宫殿风味油炸臭豆腐，外酥里嫩，配特制辣椒酱、蒜泥和香菜" },
            { name: "Liangpi", name_target: "陕西凉皮", price: "¥10", description_target: "西安手工凉皮配面筋块、豆芽、黄瓜丝，浇上辣椒油、醋和芝麻酱" },
            { name: "Shaomai", name_target: "烧卖", price: "¥18", description_target: "内蒙古呼和浩特传统羊肉烧卖，薄皮大馅，鲜嫩多汁" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "烧烤",
          items: [
            { name: "Xinjiang Lamb", name_target: "新疆大串羊肉串", price: "¥10", description_target: "选用新疆羔羊后腿肉，配以孜然、辣椒面和盐，在炭火上烤至外焦里嫩" },
            { name: "Grilled Oysters", name_target: "蒜蓉烤生蚝", price: "¥15", description_target: "新鲜生蚝配蒜蓉粉丝，炭火烤至蒜香四溢" },
            { name: "Grilled Fish", name_target: "万州烤鱼", price: "¥58", description_target: "重庆万州特色烤鱼，整条鱼先烤后炖，配豆腐、莲藕和各种蔬菜在麻辣锅底中" },
            { name: "Grilled Squid", name_target: "铁板鱿鱼", price: "¥12", description_target: "整只鱿鱼在铁板上煎烤，刷上特制酱料，撒孜然和辣椒" }
          ]
        },
        {
          name: "Sweets",
          name_target: "甜品",
          items: [
            { name: "Candied Hawthorn", name_target: "老北京糖葫芦", price: "¥10", description_target: "精选山楂果裹上熬制的冰糖外衣，晶莹剔透，酸甜适口，老北京胡同里的传统味道" },
            { name: "Egg Waffle", name_target: "鸡蛋仔", price: "¥15", description_target: "香港街头经典鸡蛋仔，外脆内软，蛋香浓郁，可搭配冰淇淋和水果" },
            { name: "Tangyuan", name_target: "酒酿小圆子", price: "¥12", description_target: "上海传统甜品，小糯米圆子配醪糟酒酿、桂花和枸杞，温暖甜蜜" },
            { name: "Dragon Beard Candy", name_target: "龙须糖", price: "¥15", description_target: "传统手工龙须糖，麦芽糖拉丝如须，包裹花生、芝麻和椰蓉，入口即化" }
          ]
        },
        {
          name: "Drinks",
          name_target: "饮品",
          items: [
            { name: "Plum Juice", name_target: "老北京酸梅汤", price: "¥8", description_target: "乌梅、山楂、甘草、桂花熬制的传统酸梅汤，冰镇后消暑解渴" },
            { name: "Bubble Tea", name_target: "手工珍珠奶茶", price: "¥18", description_target: "现煮黑糖珍珠搭配鲜煮茶汤和新鲜牛奶，口感醇厚弹牙" },
            { name: "Osmanthus Wine", name_target: "桂花米酒", price: "¥15", description_target: "甜糯米发酵的传统米酒配新鲜桂花，微甜温和，祭典必饮" },
            { name: "Herbal Tea", name_target: "广东凉茶", price: "¥10", description_target: "广东传统凉茶，多种草药熬制而成，清热解暑，苦后回甘" }
          ]
        }
      ]
    }
  },
  korean: {
    beginner: {
      sections: [
        {
          name: "Street Food",
          name_target: "길거리 음식",
          items: [
            { name: "Tteokbokki", name_target: "떡볶이", price: "₩4,000", description_target: "매콤한 떡볶이" },
            { name: "Corn Dog", name_target: "핫도그", price: "₩3,000", description_target: "치즈 핫도그" },
            { name: "Kimbap", name_target: "김밥", price: "₩3,500", description_target: "야채와 참치 김밥" }
          ]
        },
        {
          name: "Drinks",
          name_target: "음료",
          items: [
            { name: "Sikhye", name_target: "식혜", price: "₩2,000", description_target: "달콤한 쌀 음료" },
            { name: "Soju", name_target: "소주", price: "₩4,000", description_target: "한국 전통 소주" },
            { name: "Banana Milk", name_target: "바나나우유", price: "₩1,500", description_target: "달콤한 바나나 우유" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Street Food",
          name_target: "길거리 음식",
          items: [
            { name: "Tteokbokki", name_target: "떡볶이", price: "₩5,000", description_target: "고추장 양념의 쫄깃한 떡볶이에 어묵과 삶은 달걀 추가" },
            { name: "Sundae", name_target: "순대", price: "₩5,000", description_target: "당면과 돼지 피를 넣어 만든 전통 순대, 소금과 간장에" },
            { name: "Hotteok", name_target: "호떡", price: "₩2,000", description_target: "흑설탕, 계피, 견과류가 들어간 달콤한 부침개" },
            { name: "Twigim", name_target: "튀김", price: "₩4,000", description_target: "고구마, 김말이, 새우 등 모듬 튀김" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "구이",
          items: [
            { name: "Dak-kkochi", name_target: "닭꼬치", price: "₩3,000", description_target: "매콤달콤한 양념 닭꼬치, 숯불에 구운 것" },
            { name: "Grilled Corn", name_target: "옥수수 구이", price: "₩3,000", description_target: "간장 양념을 발라 숯불에 구운 옥수수" },
            { name: "Fish Cake Skewer", name_target: "어묵꼬치", price: "₩1,000", description_target: "따뜻한 국물과 함께 먹는 어묵 꼬치" }
          ]
        },
        {
          name: "Sweets & Drinks",
          name_target: "간식 & 음료",
          items: [
            { name: "Bungeoppang", name_target: "붕어빵", price: "₩2,000", description_target: "물고기 모양의 팥앙금이 들어간 달콤한 과자" },
            { name: "Makgeolli", name_target: "막걸리", price: "₩5,000", description_target: "쌀로 만든 전통 탁주, 달콤하고 부드러운 맛" },
            { name: "Dalgona", name_target: "달고나", price: "₩2,000", description_target: "설탕과 소다를 녹여 만든 추억의 달고나 사탕" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Street Food",
          name_target: "길거리 음식",
          items: [
            { name: "Tteokbokki", name_target: "국물 떡볶이", price: "₩6,000", description_target: "고추장과 고춧가루로 양념한 쫄깃한 떡에 어묵, 삶은 달걀, 파를 넣고 푹 끓인 국물 떡볶이" },
            { name: "Sundae", name_target: "전통 순대", price: "₩6,000", description_target: "당면, 찹쌀, 돼지 피와 다진 야채를 넣어 만든 전통 방식의 순대, 떡볶이 국물과 함께" },
            { name: "Bindaetteok", name_target: "빈대떡", price: "₩7,000", description_target: "녹두를 갈아 돼지고기, 숙주, 김치를 넣고 바삭하게 부친 광장시장 스타일 빈대떡" },
            { name: "Mandu", name_target: "왕만두", price: "₩5,000", description_target: "돼지고기, 두부, 김치, 당면을 넣어 빚은 큼직한 왕만두, 찐 것 또는 군만두" },
            { name: "Gyeranppang", name_target: "계란빵", price: "₩3,000", description_target: "달걀을 통째로 넣어 구운 부드러운 계란빵, 겨울 길거리의 인기 간식" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "구이류",
          items: [
            { name: "Dak-kkochi", name_target: "매콤 닭꼬치", price: "₩4,000", description_target: "고추장과 간장 양념을 발라 숯불에 구운 닭꼬치, 깨와 파 토핑" },
            { name: "Gopchang", name_target: "곱창구이", price: "₩15,000", description_target: "신선한 소곱창을 양념에 재워 철판에 구운 야시장 인기 메뉴, 소금구이 또는 양념구이 선택" },
            { name: "Grilled Shellfish", name_target: "조개구이", price: "₩18,000", description_target: "가리비, 전복, 홍합 등 신선한 해산물을 숯불 위에서 구워 먹는 해변 포장마차 스타일" },
            { name: "Ttongkkochi", name_target: "똥꼬치", price: "₩4,000", description_target: "닭똥집을 양념에 재워 숯불에 바삭하게 구운 포장마차 안주" }
          ]
        },
        {
          name: "Sweets",
          name_target: "간식",
          items: [
            { name: "Bungeoppang", name_target: "슈크림 붕어빵", price: "₩3,000", description_target: "바삭한 반죽에 팥앙금 또는 슈크림을 가득 넣은 따끈한 붕어빵" },
            { name: "Hotteok", name_target: "씨앗 호떡", price: "₩3,000", description_target: "흑설탕, 계피, 해바라기씨, 땅콩을 넣어 바삭하게 부친 부산식 씨앗 호떡" },
            { name: "Dalgona", name_target: "달고나", price: "₩2,500", description_target: "설탕을 녹여 소다와 섞어 만든 추억의 달고나, 별 모양 뽑기 도전" },
            { name: "Patbingsu", name_target: "노점 팥빙수", price: "₩8,000", description_target: "곱게 간 우유 얼음 위에 수제 팥과 떡, 콩가루를 올린 전통 팥빙수" }
          ]
        },
        {
          name: "Drinks",
          name_target: "음료",
          items: [
            { name: "Makgeolli", name_target: "생막걸리", price: "₩7,000", description_target: "국산 쌀로 빚어 걸러낸 전통 생막걸리, 달콤하면서 약간의 탄산감이 있는 살아있는 술" },
            { name: "Sujeonggwa", name_target: "수정과", price: "₩3,000", description_target: "계피와 생강을 오래 달여 곶감을 띄운 전통 음료, 차갑게 마시면 더욱 맛있는 축제 음료" },
            { name: "Corn Tea", name_target: "옥수수차", price: "₩2,000", description_target: "볶은 옥수수로 우려낸 고소한 전통차, 뜨겁게 또는 차갑게" },
            { name: "Fruit Soju", name_target: "과일 소주", price: "₩5,000", description_target: "자두, 복숭아 또는 청포도 맛 소주, 달콤하고 시원하게 즐기는 축제의 술" }
          ]
        }
      ]
    }
  },
  arabic: {
    beginner: {
      sections: [
        {
          name: "Street Food",
          name_target: "أكل الشارع",
          items: [
            { name: "Falafel", name_target: "فلافل", price: "١٠ د.إ", description_target: "فلافل مقلية مع خبز" },
            { name: "Shawarma", name_target: "شاورما", price: "١٥ د.إ", description_target: "شاورما دجاج بالخبز" },
            { name: "Manakish", name_target: "مناقيش", price: "١٢ د.إ", description_target: "مناقيش بالزعتر والجبنة" }
          ]
        },
        {
          name: "Drinks",
          name_target: "مشروبات",
          items: [
            { name: "Fresh Juice", name_target: "عصير طازج", price: "١٠ د.إ", description_target: "عصير برتقال طازج" },
            { name: "Tea", name_target: "شاي", price: "٥ د.إ", description_target: "شاي أحمر بالنعناع" },
            { name: "Lemonade", name_target: "ليمونادة", price: "٨ د.إ", description_target: "ليمونادة بالنعناع باردة" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Street Food",
          name_target: "أكل الشارع",
          items: [
            { name: "Falafel Wrap", name_target: "ساندويش فلافل", price: "١٢ د.إ", description_target: "خبز عربي مع فلافل مقرمشة وطحينة وخضار وطرشي" },
            { name: "Shawarma Platter", name_target: "صحن شاورما", price: "٢٠ د.إ", description_target: "شاورما لحم مع أرز بسمتي وسلطة وصلصة طحينة" },
            { name: "Sfiha", name_target: "صفيحة", price: "١٥ د.إ", description_target: "فطائر مفتوحة باللحم والبصل والطماطم والبهارات" },
            { name: "Sambousek", name_target: "سمبوسك", price: "١٢ د.إ", description_target: "معجنات مقلية محشوة بالجبن أو اللحم مع الصنوبر" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "مشاوي",
          items: [
            { name: "Lamb Kebab", name_target: "كباب لحم غنم", price: "٢٥ د.إ", description_target: "كباب لحم غنم مشوي على الفحم مع بصل مشوي وطماطم" },
            { name: "Chicken Tawook", name_target: "طاووق دجاج", price: "٢٠ د.إ", description_target: "أسياخ دجاج متبلة بالثوم والليمون مشوية على الفحم" },
            { name: "Kofta", name_target: "كفتة مشوية", price: "٢٢ د.إ", description_target: "كفتة لحم مفروم مع بقدونس وبصل مشوية على أسياخ" }
          ]
        },
        {
          name: "Sweets & Drinks",
          name_target: "حلويات ومشروبات",
          items: [
            { name: "Baklava", name_target: "بقلاوة", price: "١٥ د.إ", description_target: "بقلاوة بالفستق الحلبي مع شراب السكر" },
            { name: "Qamar al-Din", name_target: "قمر الدين", price: "١٠ د.إ", description_target: "مشروب المشمش التقليدي البارد" },
            { name: "Arabic Coffee", name_target: "قهوة عربية", price: "١٠ د.إ", description_target: "قهوة عربية بالهيل مع التمر" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Street Food",
          name_target: "أكل الشارع",
          items: [
            { name: "Falafel Wrap", name_target: "لفة فلافل بيروتية", price: "١٥ د.إ", description_target: "خبز صاج رقيق مع فلافل مقرمشة من الحمص والفول، طحينة، بقدونس، طماطم ومخللات مشكلة" },
            { name: "Liver Sandwich", name_target: "ساندويش كبدة إسكندراني", price: "١٨ د.إ", description_target: "كبدة بقري مقطعة ومقلية مع الفلفل الحار والثوم والكمون في خبز بلدي على الطريقة المصرية" },
            { name: "Arayes", name_target: "عرايس كفتة", price: "٢٠ د.إ", description_target: "خبز بيتا محشو بالكفتة المتبلة بالبقدونس والبصل والبهارات، مشوي على الفحم حتى يصبح مقرمشاً" },
            { name: "Manakish Zaatar", name_target: "مناقيش زعتر بزيت", price: "١٢ د.إ", description_target: "عجينة طازجة مخبوزة في الفرن مع خلطة الزعتر وزيت الزيتون البكر والسماق على الطريقة اللبنانية" },
            { name: "Koshari", name_target: "كشري مصري", price: "١٥ د.إ", description_target: "طبق مصري شعبي من الأرز والمعكرونة والعدس والحمص مع صلصة الطماطم الحارة والبصل المقلي والدقة" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "مشاوي",
          items: [
            { name: "Mixed Grill Platter", name_target: "مشاوي مشكلة ملوكية", price: "٤٥ د.إ", description_target: "تشكيلة فاخرة من كباب الغنم وشقف اللحم وطاووق الدجاج وكفتة مشوية على الفحم مع خبز طازج" },
            { name: "Lamb Chops", name_target: "ريش غنم مشوية", price: "٣٥ د.إ", description_target: "ريش غنم متبلة بالأعشاب والثوم وزيت الزيتون، مشوية على الجمر حتى النضج المثالي" },
            { name: "Grilled Hammour", name_target: "هامور مشوي", price: "٤٠ د.إ", description_target: "سمك هامور طازج متبل بالكمون والكزبرة والليمون، مشوي على الفحم مع صلصة الطحينة" },
            { name: "Ouzi", name_target: "أوزي", price: "٣٠ د.إ", description_target: "أرز باللحم والبازلاء والجزر ملفوف في عجينة رقيقة ومخبوز حتى يصبح ذهبياً مع المكسرات" }
          ]
        },
        {
          name: "Sweets",
          name_target: "حلويات",
          items: [
            { name: "Kunafa", name_target: "كنافة نابلسية ساخنة", price: "٢٥ د.إ", description_target: "كنافة طازجة بالجبن النابلسي مع شعيرية مقرمشة ذهبية، مغمورة بشراب السكر بماء الورد والفستق" },
            { name: "Luqaimat", name_target: "لقيمات", price: "١٥ د.إ", description_target: "كرات عجين مقلية ذهبية مغمورة بدبس التمر أو شراب السكر بالهيل والزعفران، حلوى خليجية تقليدية" },
            { name: "Halawet el-Jibn", name_target: "حلاوة الجبن شامية", price: "٢٠ د.إ", description_target: "لفائف من عجينة الجبن العكاوي والسميد محشوة بالقشطة، مع شراب الزهر والفستق المطحون" },
            { name: "Knafeh Rolls", name_target: "أصابع كنافة بالقشطة", price: "١٨ د.إ", description_target: "أصابع كنافة مقرمشة محشوة بالقشطة الطازجة ومغموسة بشراب السكر مع ماء الزهر" }
          ]
        },
        {
          name: "Drinks",
          name_target: "مشروبات",
          items: [
            { name: "Arabic Coffee", name_target: "قهوة عربية سادة", price: "١٢ د.إ", description_target: "قهوة عربية محمصة طازجاً مع الهيل والزعفران، تقدم في دلة تقليدية مع التمر السعودي الفاخر" },
            { name: "Jallab", name_target: "جلاب شامي", price: "١٥ د.إ", description_target: "مشروب الجلاب التقليدي من دبس الخروب والتمر وماء الورد مع الصنوبر والزبيب والثلج المجروش" },
            { name: "Tamarind Juice", name_target: "عصير تمر هندي", price: "١٢ د.إ", description_target: "عصير التمر الهندي المنقوع والمصفى مع السكر وماء الورد، مشروب رمضاني تقليدي بارد ومنعش" },
            { name: "Sahlab", name_target: "سحلب ساخن", price: "١٥ د.إ", description_target: "مشروب كريمي ساخن من مسحوق الأوركيد مع الحليب والقرفة والفستق وجوز الهند المبشور" }
          ]
        }
      ]
    }
  },
  russian: {
    beginner: {
      sections: [
        {
          name: "Street Food",
          name_target: "Уличная еда",
          items: [
            { name: "Blini", name_target: "Блины", price: "₽200", description_target: "Блины со сметаной" },
            { name: "Pirozhki", name_target: "Пирожки", price: "₽150", description_target: "Жареные пирожки с мясом" },
            { name: "Shashlik", name_target: "Шашлык", price: "₽350", description_target: "Шашлык из свинины" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Напитки",
          items: [
            { name: "Tea", name_target: "Чай", price: "₽100", description_target: "Горячий чай с лимоном" },
            { name: "Kvass", name_target: "Квас", price: "₽100", description_target: "Холодный хлебный квас" },
            { name: "Compote", name_target: "Компот", price: "₽100", description_target: "Фруктовый компот" }
          ]
        }
      ]
    },
    intermediate: {
      sections: [
        {
          name: "Street Food",
          name_target: "Уличная еда",
          items: [
            { name: "Blini with Fillings", name_target: "Блины с начинкой", price: "₽250", description_target: "Тонкие блины с творогом, мясом или грибами на выбор" },
            { name: "Chebureki", name_target: "Чебуреки", price: "₽200", description_target: "Хрустящие чебуреки с сочной мясной начинкой" },
            { name: "Pelmeni", name_target: "Пельмени на вынос", price: "₽300", description_target: "Горячие пельмени со сметаной и укропом" },
            { name: "Pirozhki", name_target: "Пирожки печёные", price: "₽180", description_target: "Пирожки из дрожжевого теста с капустой, мясом или картошкой" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "С мангала",
          items: [
            { name: "Pork Shashlik", name_target: "Шашлык из свиной шеи", price: "₽400", description_target: "Маринованная свинина на углях с маринованным луком и лавашем" },
            { name: "Chicken Shashlik", name_target: "Шашлык из курицы", price: "₽350", description_target: "Куриные бёдра на шампурах, маринованные в кефире с чесноком" },
            { name: "Lyulya Kebab", name_target: "Люля-кебаб", price: "₽350", description_target: "Кебаб из рубленой баранины с пряностями на шампуре" }
          ]
        },
        {
          name: "Sweets & Drinks",
          name_target: "Сладости и напитки",
          items: [
            { name: "Ponchiki", name_target: "Пончики", price: "₽150", description_target: "Горячие пончики с сахарной пудрой или сгущёнкой" },
            { name: "Medovukha", name_target: "Медовуха", price: "₽250", description_target: "Традиционный хмельной напиток из мёда" },
            { name: "Sbiten", name_target: "Сбитень", price: "₽200", description_target: "Горячий напиток из мёда с пряностями и травами" }
          ]
        }
      ]
    },
    advanced: {
      sections: [
        {
          name: "Street Food",
          name_target: "Уличная еда",
          items: [
            { name: "Blini with Caviar", name_target: "Блины с красной икрой", price: "₽500", description_target: "Тончайшие блинчики из гречневой муки с дальневосточной красной икрой и нежной сметаной" },
            { name: "Chebureki", name_target: "Крымские чебуреки", price: "₽250", description_target: "Хрустящие чебуреки с тонким тестом и сочной начинкой из рубленой баранины с луком и зеленью" },
            { name: "Belyash", name_target: "Беляши", price: "₽200", description_target: "Пышные жареные пирожки из дрожжевого теста с мясной начинкой из говядины и лука, с хрустящей корочкой" },
            { name: "Kartoshka", name_target: "Печёная картошка", price: "₽300", description_target: "Печёный в углях картофель с маслом, укропом, малосольными огурцами и квашеной капустой" },
            { name: "Ukha in Bread", name_target: "Уха в хлебной чаше", price: "₽450", description_target: "Наваристая уха из трёх видов речной рыбы, подаётся в выпеченной хлебной чаше с зеленью и перцем" }
          ]
        },
        {
          name: "Grilled Items",
          name_target: "С мангала и печи",
          items: [
            { name: "Lamb Shashlik", name_target: "Шашлык из каре ягнёнка", price: "₽600", description_target: "Маринованное каре молодого ягнёнка на виноградной лозе с кавказскими травами и гранатовым соусом наршараб" },
            { name: "Sturgeon Shashlik", name_target: "Шашлык из осётра", price: "₽700", description_target: "Осётр на шампуре, маринованный в белом вине с лимоном и прованскими травами, приготовленный на углях" },
            { name: "Lyulya Kebab", name_target: "Люля-кебаб из баранины", price: "₽400", description_target: "Кебаб из рубленой баранины с курдючным жиром, кинзой и зирой, обжаренный на мангале до золотистой корочки" },
            { name: "Whole Chicken", name_target: "Цыплёнок табака", price: "₽550", description_target: "Цыплёнок по-грузински, расплющенный под прессом и жаренный на сковороде с чесночным соусом и ткемали" }
          ]
        },
        {
          name: "Sweets",
          name_target: "Сладости",
          items: [
            { name: "Ponchiki", name_target: "Ленинградские пончики", price: "₽200", description_target: "Горячие пышные пончики с сахарной пудрой по рецепту легендарной ленинградской пончиковой на Желябова" },
            { name: "Pryanik", name_target: "Тульский пряник", price: "₽250", description_target: "Печатный тульский пряник с начинкой из фруктового повидла и сахарной глазурью, старинный русский рецепт" },
            { name: "Pastila", name_target: "Коломенская пастила", price: "₽300", description_target: "Воздушная яблочная пастила из антоновских яблок по старинному рецепту коломенских монахинь" },
            { name: "Vatrushka", name_target: "Ватрушка с творогом", price: "₽180", description_target: "Открытый пирожок из сдобного теста с нежной творожной начинкой, посыпанный сахарной пудрой" }
          ]
        },
        {
          name: "Drinks",
          name_target: "Напитки",
          items: [
            { name: "Medovukha", name_target: "Суздальская медовуха", price: "₽300", description_target: "Традиционный хмельной напиток из натурального мёда, сваренный по монастырскому рецепту Суздаля" },
            { name: "Sbiten", name_target: "Горячий сбитень", price: "₽250", description_target: "Старинный русский горячий напиток из мёда с имбирём, корицей, гвоздикой и душистыми травами" },
            { name: "Mors", name_target: "Клюквенный морс", price: "₽150", description_target: "Освежающий морс из карельской клюквы с натуральным мёдом, подаётся холодным" },
            { name: "Ivan Chai", name_target: "Иван-чай", price: "₽200", description_target: "Ферментированный иван-чай ручного сбора из Вологодской области, заваренный по старинной русской традиции" }
          ]
        }
      ]
    }
  }
};

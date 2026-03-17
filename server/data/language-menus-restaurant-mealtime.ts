import type { MenuSections } from './language-menus-restaurant-festival';

export const breakfastMenus: Record<string, Record<string, MenuSections>> = {

  spanish: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "Bebidas",
          items: [
            { name: "Coffee with Milk", name_target: "Café con leche", price: "€1.50", description_target: "Café con leche caliente" },
            { name: "Orange Juice", name_target: "Zumo de naranja", price: "€2.00", description_target: "Zumo natural de naranja" },
            { name: "Tea", name_target: "Té", price: "€1.50", description_target: "Té caliente" },
          ],
        },
        {
          name: "Breakfast",
          name_target: "Desayuno",
          items: [
            { name: "Toast with Tomato", name_target: "Tostada con tomate", price: "€2.50", description_target: "Pan tostado con tomate y aceite" },
            { name: "Churros with Chocolate", name_target: "Churros con chocolate", price: "€3.50", description_target: "Churros con chocolate caliente" },
            { name: "Croissant", name_target: "Croissant", price: "€2.00", description_target: "Croissant de mantequilla" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Bebidas Calientes",
          items: [
            { name: "Coffee with Milk", name_target: "Café con leche", price: "€1.60", description_target: "Café solo con leche entera al gusto" },
            { name: "Cortado", name_target: "Café cortado", price: "€1.40", description_target: "Café espresso con un poco de leche" },
            { name: "Hot Chocolate", name_target: "Cola Cao", price: "€2.00", description_target: "Cacao caliente con leche" },
            { name: "Tea with Milk", name_target: "Té con leche", price: "€1.60", description_target: "Té de hierbas o negro con leche" },
          ],
        },
        {
          name: "Juices",
          name_target: "Zumos",
          items: [
            { name: "Fresh Orange Juice", name_target: "Zumo de naranja natural", price: "€2.50", description_target: "Zumo recién exprimido de naranja valenciana" },
            { name: "Pineapple Juice", name_target: "Zumo de piña", price: "€2.00", description_target: "Zumo de piña en botella" },
          ],
        },
        {
          name: "Food",
          name_target: "Para Comer",
          items: [
            { name: "Toast with Tomato", name_target: "Tostada con tomate", price: "€2.50", description_target: "Pan de barra tostado con tomate rallado y aceite de oliva" },
            { name: "Toast with Ham", name_target: "Tostada con jamón", price: "€3.50", description_target: "Pan tostado con jamón serrano y tomate" },
            { name: "Churros with Chocolate", name_target: "Churros con chocolate", price: "€3.80", description_target: "Media docena de churros con chocolate espeso para mojar" },
            { name: "Butter Croissant", name_target: "Croissant de mantequilla", price: "€2.20", description_target: "Croissant hojaldrado con mantequilla o mermelada" },
            { name: "Magdalenas", name_target: "Magdalenas", price: "€1.80", description_target: "Tres magdalenas caseras de limón o de naranja" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Bebidas Calientes",
          items: [
            { name: "Coffee with Milk", name_target: "Café con leche", price: "€1.80", description_target: "Café de tueste natural con leche entera vaporizada al gusto del cliente — la combinación favorita de los españoles en el desayuno" },
            { name: "Cortado", name_target: "Café cortado", price: "€1.60", description_target: "Espresso breve con una pequeña cantidad de leche para suavizar el amargor — clásico de la barra española" },
            { name: "Black Coffee", name_target: "Café solo", price: "€1.40", description_target: "Espresso puro sin leche, concentrado y aromático" },
            { name: "Decaf", name_target: "Café descafeinado de máquina", price: "€1.60", description_target: "Café descafeinado extraído por máquina, no soluble, con la misma cremosidad que el normal" },
          ],
        },
        {
          name: "Juices & Cold Drinks",
          name_target: "Zumos y Refrescos",
          items: [
            { name: "Freshly Squeezed Orange Juice", name_target: "Zumo de naranja recién exprimido", price: "€2.80", description_target: "Naranjas valencianas exprimidas al momento — el acompañante ideal de un buen desayuno español" },
            { name: "Freshly Squeezed Grapefruit Juice", name_target: "Zumo de pomelo natural", price: "€2.80", description_target: "Pomelo exprimido al momento, ligeramente amargo y refrescante" },
            { name: "Sparkling Water", name_target: "Agua con gas", price: "€1.50", description_target: "Agua mineral con gas natural" },
          ],
        },
        {
          name: "Savoury",
          name_target: "Salado",
          items: [
            { name: "Toast with Tomato and Olive Oil", name_target: "Tostada con tomate rallado y AOVE", price: "€3.00", description_target: "Pan de masa madre tostado con tomate de colgar rallado, aceite de oliva virgen extra y sal en escamas — el desayuno andaluz por excelencia" },
            { name: "Toast with Serrano Ham", name_target: "Tostada con jamón serrano", price: "€4.50", description_target: "Pan tostado con lonchas de jamón serrano sobre tomate rallado y aceite — una combinación clásica e irresistible" },
            { name: "Spanish Omelette", name_target: "Pincho de tortilla española", price: "€2.50", description_target: "Porción de tortilla de patata y cebolla confitada, cuajada en su punto — tortilla como debe ser" },
            { name: "Ham Croquettes", name_target: "Croquetas de jamón ibérico", price: "€4.00", description_target: "Dos croquetas cremosas de bechamel con jamón ibérico, rebozadas y fritas al momento" },
          ],
        },
        {
          name: "Sweet",
          name_target: "Dulce",
          items: [
            { name: "Churros with Thick Chocolate", name_target: "Churros con chocolate a la taza", price: "€4.20", description_target: "Media docena de churros artesanales con chocolate espeso para mojar, elaborado con cacao puro de primera calidad" },
            { name: "Butter Croissant", name_target: "Croissant de mantequilla", price: "€2.50", description_target: "Croissant hojaldrado con mantequilla AOP, crujiente por fuera y esponjoso por dentro" },
            { name: "Lemon Magdalenas", name_target: "Magdalenas de limón caseras", price: "€2.20", description_target: "Tres magdalenas elaboradas con aceite de oliva y ralladura de limón, de receta tradicional española" },
            { name: "Ensaimada", name_target: "Ensaimada mallorquina", price: "€3.00", description_target: "Bollo espiral de masa hojaldrada con manteca de cerdo, especialidad de las Islas Baleares" },
          ],
        },
      ],
    },
  },

  french: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "Boissons",
          items: [
            { name: "Coffee with Milk", name_target: "Café au lait", price: "€2.50", description_target: "Café avec du lait chaud" },
            { name: "Hot Chocolate", name_target: "Chocolat chaud", price: "€3.00", description_target: "Chocolat chaud et crémeux" },
            { name: "Orange Juice", name_target: "Jus d'orange", price: "€3.00", description_target: "Jus d'orange pressé" },
          ],
        },
        {
          name: "Pastries",
          name_target: "Viennoiseries",
          items: [
            { name: "Croissant", name_target: "Croissant", price: "€1.80", description_target: "Croissant au beurre" },
            { name: "Chocolate Croissant", name_target: "Pain au chocolat", price: "€2.00", description_target: "Pâte feuilletée avec du chocolat" },
            { name: "Buttered Bread", name_target: "Tartine beurrée", price: "€2.00", description_target: "Pain grillé avec du beurre et de la confiture" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Boissons Chaudes",
          items: [
            { name: "Coffee with Hot Milk", name_target: "Café au lait", price: "€2.80", description_target: "Café fort avec beaucoup de lait chaud, servi dans un grand bol" },
            { name: "Espresso", name_target: "Café espresso", price: "€1.80", description_target: "Petit café fort servi dans une petite tasse" },
            { name: "Creamy Coffee", name_target: "Café crème", price: "€3.00", description_target: "Espresso avec de la crème fouettée ou du lait mousseux" },
            { name: "Herbal Tea", name_target: "Infusion", price: "€2.50", description_target: "Tisane de camomille, verveine ou menthe" },
          ],
        },
        {
          name: "Pastries & Bread",
          name_target: "Viennoiseries et Pain",
          items: [
            { name: "Croissant", name_target: "Croissant au beurre", price: "€2.00", description_target: "Croissant feuilleté au beurre de qualité supérieure" },
            { name: "Chocolate Croissant", name_target: "Pain au chocolat", price: "€2.20", description_target: "Pâte feuilletée croustillante garnie de deux barres de chocolat noir" },
            { name: "Almond Croissant", name_target: "Croissant aux amandes", price: "€2.50", description_target: "Croissant fourré à la crème d'amandes et parsemé d'amandes effilées" },
            { name: "Buttered Toast", name_target: "Tartine au beurre et confiture", price: "€2.00", description_target: "Baguette grillée avec beurre doux et confiture de fraises ou d'abricots" },
            { name: "Brioche", name_target: "Brioche", price: "€2.50", description_target: "Brioche moelleuse au beurre, légèrement sucrée" },
          ],
        },
        {
          name: "Morning Formula",
          name_target: "Formule Petit-déjeuner",
          items: [
            { name: "Continental Breakfast", name_target: "Petit-déjeuner continental", price: "€8.50", description_target: "Café au lait ou jus d'orange + deux viennoiseries au choix — formule complète pour bien démarrer la journée" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "Boissons Chaudes",
          items: [
            { name: "Coffee with Hot Milk", name_target: "Café au lait", price: "€3.20", description_target: "Café fort versé dans un grand bol avec du lait chaud — la tradition française du matin, idéal pour y tremper des viennoiseries" },
            { name: "Creamy Coffee", name_target: "Café crème", price: "€3.50", description_target: "Espresso allongé coiffé d'une fine couche de lait mousseux — à ne pas confondre avec le café au lait, servi dans une tasse à café" },
            { name: "Black Coffee", name_target: "Café noir / Expresso", price: "€2.00", description_target: "Expresso serré, aromatique et intense — les Français boivent leur café noir en fin de repas ou tôt le matin au comptoir" },
            { name: "Herbal Tea", name_target: "Infusion de plantes", price: "€3.00", description_target: "Tisane artisanale de verveine citronnée, camomille romaine ou menthe poivrée fraîche" },
            { name: "Hot Chocolate", name_target: "Chocolat chaud à l'ancienne", price: "€4.00", description_target: "Chocolat fondu de qualité supérieure avec lait entier fouetté, préparé selon la méthode traditionnelle" },
          ],
        },
        {
          name: "Pastries",
          name_target: "Viennoiseries du Boulanger",
          items: [
            { name: "Butter Croissant", name_target: "Croissant pur beurre", price: "€2.20", description_target: "Croissant artisanal en pâte feuilletée au beurre d'Isigny AOP — la quintessence de la viennoiserie française, croustillant à l'extérieur, filant à l'intérieur" },
            { name: "Chocolate Croissant", name_target: "Pain au chocolat", price: "€2.50", description_target: "Pâte feuilletée dorée renfermant deux barres de chocolat de couverture Valrhona — une institution du petit-déjeuner français" },
            { name: "Almond Croissant", name_target: "Croissant aux amandes", price: "€2.80", description_target: "Croissant de la veille rebeurré, fourré à la frangipane et parsemé d'amandes effilées grillées et de sucre glace" },
            { name: "Pain Suisse", name_target: "Pain suisse aux pépites de chocolat", price: "€2.80", description_target: "Rectangle de pâte briochée garni de crème pâtissière à la vanille et pépites de chocolat noir" },
          ],
        },
        {
          name: "Bread & Savoury",
          name_target: "Pain et Salé",
          items: [
            { name: "Baguette with Butter and Jam", name_target: "Tartine de baguette tradition", price: "€2.50", description_target: "Demi-baguette tradition grillée, servie avec beurre AOP demi-sel et confiture artisanale de saison — le petit-déjeuner à la française dans sa plus simple expression" },
            { name: "Ham and Cheese Toast", name_target: "Croque-monsieur du matin", price: "€5.00", description_target: "Pain de mie brioché grillé avec jambon de Paris et comté fondu, beurré et doré au four" },
          ],
        },
        {
          name: "Breakfast Formula",
          name_target: "Formule Petit-déjeuner",
          items: [
            { name: "Parisian Breakfast", name_target: "Formule Parisienne", price: "€10.50", description_target: "Café au lait ou thé + deux viennoiseries au choix + jus d'orange pressé — la formule classique des bistrots parisiens" },
          ],
        },
      ],
    },
  },

  german: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "Getränke",
          items: [
            { name: "Coffee", name_target: "Kaffee", price: "€2.50", description_target: "Heißer Kaffee mit Milch" },
            { name: "Orange Juice", name_target: "Orangensaft", price: "€2.80", description_target: "Frischer Orangensaft" },
            { name: "Tea", name_target: "Tee", price: "€2.20", description_target: "Heißer Tee mit Zucker" },
          ],
        },
        {
          name: "Breakfast",
          name_target: "Frühstück",
          items: [
            { name: "Bread Roll", name_target: "Brötchen", price: "€1.50", description_target: "Frisches Brötchen mit Butter" },
            { name: "Scrambled Eggs", name_target: "Rühreier", price: "€4.50", description_target: "Zwei Rühreier mit Toast" },
            { name: "Muesli with Milk", name_target: "Müsli mit Milch", price: "€4.00", description_target: "Haferflocken mit Milch und Früchten" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Drinks",
          name_target: "Getränke",
          items: [
            { name: "Filtered Coffee", name_target: "Filterkaffee", price: "€2.50", description_target: "Klassischer Filterkaffee mit Milch und Zucker nach Wunsch" },
            { name: "Latte Macchiato", name_target: "Latte Macchiato", price: "€3.80", description_target: "Heißer Milchschaum mit einem Schuss Espresso" },
            { name: "Orange Juice", name_target: "Frisch gepresster Orangensaft", price: "€3.50", description_target: "Direkt gepresste Orangen, ohne Zusätze" },
            { name: "Apple Juice", name_target: "Apfelsaft naturtrüb", price: "€2.80", description_target: "Naturtrüber Apfelsaft aus deutschen Äpfeln" },
          ],
        },
        {
          name: "Bread & Cold Cuts",
          name_target: "Brot und Aufschnitt",
          items: [
            { name: "Bread Roll Selection", name_target: "Brötchenkorb", price: "€3.00", description_target: "Zwei Brötchen nach Wahl — Sesam, Mohn, Vollkorn oder Laugenbrötchen" },
            { name: "Cold Cuts Platter", name_target: "Aufschnittplatte", price: "€6.50", description_target: "Verschiedene Wurstsorten: Salami, Schinken und Leberwurst mit Brot" },
            { name: "Cheese Platter", name_target: "Käseplatte", price: "€5.50", description_target: "Drei Käsesorten — Gouda, Emmentaler und Camembert — mit Butter und Brot" },
            { name: "Jam and Butter", name_target: "Marmelade und Butter", price: "€2.00", description_target: "Erdbeer- oder Himbeermarmelade mit Butter und zwei Brötchen" },
          ],
        },
        {
          name: "Hot Dishes",
          name_target: "Warmes Frühstück",
          items: [
            { name: "Scrambled Eggs with Bacon", name_target: "Rühreier mit Speck", price: "€7.50", description_target: "Drei Rühreier mit knusprigem Speck und zwei Scheiben Vollkornbrot" },
            { name: "Muesli with Fruit", name_target: "Müsli mit Joghurt und Früchten", price: "€5.50", description_target: "Hafermüsli mit Naturjoghurt und frischen Früchten der Saison" },
            { name: "Porridge", name_target: "Haferbrei", price: "€5.00", description_target: "Cremiger Haferbrei mit Honig, Zimt und frischen Beeren" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Drinks",
          name_target: "Getränke",
          items: [
            { name: "Filter Coffee", name_target: "Filterkaffee", price: "€3.00", description_target: "Frisch gebrühter Filterkaffee aus fair gehandelten Arabica-Bohnen — der Klassiker am deutschen Frühstückstisch, oft in großen Mengen getrunken" },
            { name: "Cappuccino", name_target: "Cappuccino", price: "€3.80", description_target: "Doppelter Espresso mit aufgeschäumter Vollmilch, bestäubt mit Kakao — in Deutschland immer zum Frühstück akzeptiert, anders als in Italien" },
            { name: "Freshly Squeezed OJ", name_target: "Frisch gepresster Orangensaft", price: "€4.00", description_target: "Direkt aus Orangen gepresst, ohne Konservierungsstoffe oder Zusätze — der perfekte Start in den Tag" },
            { name: "Buttermilch", name_target: "Buttermilch", price: "€2.50", description_target: "Klassisches deutsches Frühstücksgetränk, leicht säuerlich und erfrischend" },
          ],
        },
        {
          name: "Bread & Spreads",
          name_target: "Brot, Brötchen und Aufstriche",
          items: [
            { name: "Bread Roll Basket", name_target: "Gemischter Brötchenkorb", price: "€4.00", description_target: "Auswahl an Brötchen: Sesambrötchen, Laugenbrötchen, Vollkornbrötchen und Roggenbrötchen — deutsches Brot gilt als das vielfältigste der Welt" },
            { name: "Cold Cuts", name_target: "Aufschnittplatte mit Beilagen", price: "€8.00", description_target: "Westfälischer Schinken, Schwarzwälder Schinken, Salami und Leberwurst, serviert mit Cornichons, Radieschen und Butter" },
            { name: "German Cheese Selection", name_target: "Deutsche Käseauswahl", price: "€7.50", description_target: "Allgäuer Emmentaler, Berliner Landkäse und Weichkäse Camembert mit Holzofenbrot und Butter — Deutschland hat über 600 Käsesorten" },
          ],
        },
        {
          name: "Hot Dishes",
          name_target: "Warme Frühstücksgerichte",
          items: [
            { name: "Scrambled Eggs with Chives", name_target: "Rühreier mit Schnittlauch und Speck", price: "€9.00", description_target: "Drei sämige Rühreier aus Freilandhaltung mit knusprigem Schwarzwälder Speck, Schnittlauch und Schwarzbrot" },
            { name: "Bircher Muesli", name_target: "Birchermüsli nach Schweizer Art", price: "€6.50", description_target: "Über Nacht eingeweichte Haferflocken mit Joghurt, geriebenem Apfel, Haselnüssen und einem Schuss Zitronensaft — nach dem Originalrezept von Dr. Bircher-Benner" },
            { name: "Semolina Porridge", name_target: "Grießbrei mit Kirschen", price: "€5.50", description_target: "Cremiger Grießbrei mit Vollmilch und einem Klecks Sauerkirschkompott — ein klassisches deutsches Kinderfrühstück das Erwachsene lieben" },
          ],
        },
      ],
    },
  },

  italian: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "Bevande",
          items: [
            { name: "Espresso", name_target: "Caffè espresso", price: "€1.10", description_target: "Caffè caldo e forte" },
            { name: "Cappuccino", name_target: "Cappuccino", price: "€1.50", description_target: "Caffè con latte e schiuma" },
            { name: "Orange Juice", name_target: "Succo d'arancia", price: "€2.50", description_target: "Succo fresco di arancia" },
          ],
        },
        {
          name: "Pastries",
          name_target: "Dolci e Pasticcini",
          items: [
            { name: "Croissant", name_target: "Cornetto", price: "€1.20", description_target: "Cornetto semplice o con crema" },
            { name: "Jam-filled Croissant", name_target: "Cornetto alla marmellata", price: "€1.30", description_target: "Cornetto con marmellata di albicocche" },
            { name: "Fruit Juice", name_target: "Succo di frutta", price: "€2.00", description_target: "Succo di pesca o di pera" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Coffee",
          name_target: "Caffetteria",
          items: [
            { name: "Espresso", name_target: "Caffè espresso", price: "€1.20", description_target: "Caffè ristretto, corto e intenso, la base di tutta la cultura del caffè italiano" },
            { name: "Cappuccino", name_target: "Cappuccino", price: "€1.60", description_target: "Espresso con latte vaporizzato e schiuma cremosa — si beve solo al mattino in Italia" },
            { name: "Macchiato", name_target: "Caffè macchiato", price: "€1.30", description_target: "Espresso con una piccola quantità di latte — macchiato caldo o freddo" },
            { name: "Hot Chocolate", name_target: "Cioccolata calda", price: "€3.00", description_target: "Cioccolata densa e cremosa con latte intero, tipica delle pasticcerie italiane" },
          ],
        },
        {
          name: "Pastries & Sweet",
          name_target: "Pasticceria e Dolci",
          items: [
            { name: "Croissant", name_target: "Cornetto al burro", price: "€1.40", description_target: "Cornetto sfogliato al burro, vuoto o con crema pasticcera, marmellata o cioccolato" },
            { name: "Brioche", name_target: "Brioche col tuppo", price: "€1.80", description_target: "Brioche siciliana a forma di fungo, soffice e profumata — perfetta con granita o gelato" },
            { name: "Jam Doughnut", name_target: "Bombolone alla crema", price: "€1.50", description_target: "Bombolone fritto ripieno di crema pasticcera o marmellata, spolverato con zucchero a velo" },
            { name: "Ciambella", name_target: "Ciambella al forno", price: "€2.00", description_target: "Ciambella soffice al limone o al cioccolato, tipica colazione casalinga italiana" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Coffee",
          name_target: "Il Caffè",
          items: [
            { name: "Espresso", name_target: "Caffè espresso", price: "€1.30", description_target: "Espresso preparato con blend Arabica e Robusta, estratto in 25 secondi — in Italia si beve in piedi al bancone, non seduti al tavolo con un supplemento" },
            { name: "Cappuccino", name_target: "Cappuccino", price: "€1.80", description_target: "Un terzo espresso, un terzo latte vaporizzato, un terzo schiuma — categoricamente un caffè mattutino: chiedere un cappuccino dopo pranzo fa sorridere i baristi italiani" },
            { name: "Flat White Style", name_target: "Caffè latte", price: "€2.00", description_target: "Espresso con abbondante latte vaporizzato — meno schiuma del cappuccino, servito in tazza grande" },
            { name: "Ristretto", name_target: "Caffè ristretto", price: "€1.30", description_target: "Espresso con metà dell'acqua, più concentrato e meno amaro — preferito dai palati più raffinati" },
          ],
        },
        {
          name: "Pastry Counter",
          name_target: "Vetrina della Pasticceria",
          items: [
            { name: "Butter Croissant", name_target: "Cornetto al burro sfogliato", price: "€1.60", description_target: "Cornetto artigianale preparato con burro di qualità superiore e pasta sfogliata a lievitazione naturale — la colazione italiana per eccellenza" },
            { name: "Sicilian Brioche", name_target: "Brioche col tuppo siciliana", price: "€2.20", description_target: "Brioche soffice a doppio impasto tipica della Sicilia — il tuppo (il 'ciuffo') serve per inzuppare nella granita di caffè o mandorla, tradizione palermitana" },
            { name: "Sfogliatella", name_target: "Sfogliatella riccia napoletana", price: "€2.50", description_target: "Pasticcino napoletano dalla pasta sfogliata a strati concentrici, ripieno di ricotta, semolino, arancia candita e cannella — la rappresentazione della pasticceria campana" },
            { name: "Maritozzo", name_target: "Maritozzo con la panna", price: "€2.80", description_target: "Panino dolce romano a lievitazione naturale tagliato e ripieno di abbondante panna montata — colazione della tradizione laziale" },
          ],
        },
        {
          name: "Savoury",
          name_target: "Salato",
          items: [
            { name: "Ham and Cheese Toast", name_target: "Toast al prosciutto e formaggio", price: "€3.50", description_target: "Toast con prosciutto cotto e provola affumicata, tostato fino alla doratura — non è alta cucina, ma è una colazione sostanziosa che piace a tutti" },
            { name: "Tramezzino", name_target: "Tramezzino al tonno e capperi", price: "€2.80", description_target: "Pane bianco morbido senza crosta farcito con tonno, maionese e capperi — il tramezzino è un'istituzione veneziana diffusa in tutta Italia" },
          ],
        },
      ],
    },
  },

  portuguese: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "Bebidas",
          items: [
            { name: "Espresso", name_target: "Bica", price: "€0.80", description_target: "Café curto e forte" },
            { name: "Coffee with Milk", name_target: "Galão", price: "€1.20", description_target: "Café com muito leite" },
            { name: "Orange Juice", name_target: "Sumo de laranja", price: "€2.00", description_target: "Sumo de laranja natural" },
          ],
        },
        {
          name: "Pastries",
          name_target: "Pastelaria",
          items: [
            { name: "Custard Tart", name_target: "Pastel de nata", price: "€1.20", description_target: "Pastel de massa folhada com creme" },
            { name: "Buttered Toast", name_target: "Torrada com manteiga", price: "€1.50", description_target: "Torrada com manteiga e compota" },
            { name: "Croissant", name_target: "Croissant", price: "€1.50", description_target: "Croissant simples ou de manteiga" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Coffee",
          name_target: "Café",
          items: [
            { name: "Bica", name_target: "Bica", price: "€0.90", description_target: "Café expresso curto, servido em chávena pequena — o nome 'bica' é exclusivo de Lisboa" },
            { name: "Galão", name_target: "Galão", price: "€1.40", description_target: "Café com grande quantidade de leite quente espumoso, servido em copo alto" },
            { name: "Meia de Leite", name_target: "Meia de leite", price: "€1.20", description_target: "Metade leite quente, metade café — típico do Porto, equivalente ao galão lisboeta" },
            { name: "Carioca", name_target: "Carioca", price: "€0.80", description_target: "Café mais fraco que a bica, feito com a mesma quantidade de água mas menos café" },
          ],
        },
        {
          name: "Pastries",
          name_target: "Pastelaria",
          items: [
            { name: "Custard Tart", name_target: "Pastel de nata", price: "€1.30", description_target: "Pastel de massa folhada com creme de gemas e canela, originalmente de Belém — obrigatório em qualquer pequeno-almoço português" },
            { name: "Buttered Toast", name_target: "Torrada com manteiga", price: "€1.80", description_target: "Pão de forma tostado com manteiga — a torrada portuguesa é grossa e sempre servida quente" },
            { name: "Croissant with Ham", name_target: "Croissant de fiambre e queijo", price: "€2.50", description_target: "Croissant quente recheado com fiambre e queijo fundido" },
            { name: "Bola de Berlim", name_target: "Bola de Berlim com creme", price: "€1.50", description_target: "Donut português frito com recheio de creme pasteleiro amarelo — clássico das pastelarias portuguesas" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Coffee",
          name_target: "Café",
          items: [
            { name: "Bica", name_target: "Bica", price: "€1.00", description_target: "Café expresso servido em Lisboa — 'Beba Isto Com Açúcar' é a explicação popular da sigla, embora seja lenda — o café português é intenso, torrado escuro e sempre servido com um copo de água" },
            { name: "Abatanado", name_target: "Abatanado", price: "€1.20", description_target: "Expresso longo, com mais água que a bica mas menos que um café de filtro — o meio-termo perfeito para quem quer mais volume sem perder intensidade" },
            { name: "Carioca de Limão", name_target: "Carioca de limão", price: "€1.00", description_target: "Água quente passada por uma casca de limão — delicada, perfumada e sem cafeína, apreciada pelos que preferem um sabor mais suave de manhã" },
            { name: "Galão Bem Cheio", name_target: "Galão bem cheio", price: "€1.60", description_target: "Galão preparado com dupla dose de café para equilibrar o grande volume de leite — pedido assim por quem quer mais intensidade de café" },
          ],
        },
        {
          name: "Pastries",
          name_target: "Pastelaria Portuguesa",
          items: [
            { name: "Pastel de Belém", name_target: "Pastel de Belém original", price: "€1.50", description_target: "O pastel de nata original, fabricado exclusivamente na Fábrica dos Pastéis de Belém desde 1837 com receita secreta — servido polvilhado com canela e açúcar em pó" },
            { name: "Queijada de Sintra", name_target: "Queijada de Sintra", price: "€2.00", description_target: "Queijada artesanal de Sintra com recheio de requeijão, açúcar e canela em massa crocante — especialidade da vila que serviu de inspiração a poetas e reis" },
            { name: "Travesseiro de Sintra", name_target: "Travesseiro de Sintra", price: "€2.20", description_target: "Almofada de massa folhada recheada com creme de amêndoa e ovos — criada pela Casa Piriquita de Sintra, uma das pastelarias mais antigas de Portugal" },
          ],
        },
        {
          name: "Savoury",
          name_target: "Salgados",
          items: [
            { name: "Pastel de Bacalhau", name_target: "Pastel de bacalhau", price: "€2.50", description_target: "Pastel frito em forma de folha de limoeiro com recheio de bacalhau desfiado, batata e salsa — o salgado mais emblemático da gastronomia portuguesa, servido como entrada ou lanche" },
            { name: "Pão com Chouriço", name_target: "Pão com chouriço", price: "€2.00", description_target: "Pão de trigo recheado com chouriço de carne de porco fumado — versão alentejana clássica, assado no forno a lenha" },
          ],
        },
      ],
    },
  },

  japanese: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "飲み物",
          items: [
            { name: "Green Tea", name_target: "緑茶", price: "¥300", description_target: "温かい緑茶" },
            { name: "Orange Juice", name_target: "オレンジジュース", price: "¥400", description_target: "フレッシュなオレンジジュース" },
            { name: "Miso Soup", name_target: "お味噌汁", price: "¥200", description_target: "温かい味噌汁" },
          ],
        },
        {
          name: "Japanese Breakfast",
          name_target: "和朝食",
          items: [
            { name: "Rice", name_target: "ご飯", price: "¥200", description_target: "温かい白ご飯" },
            { name: "Grilled Salmon", name_target: "焼き鮭", price: "¥500", description_target: "塩焼きの鮭" },
            { name: "Japanese Omelette", name_target: "卵焼き", price: "¥300", description_target: "甘い卵焼き" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Drinks",
          name_target: "お飲み物",
          items: [
            { name: "Green Tea", name_target: "煎茶", price: "¥300", description_target: "上質な国産煎茶、茶葉から丁寧に入れたお茶" },
            { name: "Miso Soup", name_target: "味噌汁", price: "¥200", description_target: "だしをきかせた白味噌または赤味噌のお味噌汁" },
            { name: "Coffee", name_target: "コーヒー", price: "¥400", description_target: "ブレンドコーヒー、ホットまたはアイス" },
          ],
        },
        {
          name: "Japanese Breakfast Set",
          name_target: "和定食",
          items: [
            { name: "Steamed Rice", name_target: "白ご飯", price: "¥300", description_target: "国産米を使った炊きたてのご飯" },
            { name: "Grilled Salmon", name_target: "焼き鮭", price: "¥600", description_target: "塩をふって丁寧に焼いた鮭の切り身" },
            { name: "Natto", name_target: "納豆", price: "¥200", description_target: "北海道産大豆の納豆、からしとたれ付き" },
            { name: "Japanese Omelette", name_target: "だし巻き卵", price: "¥400", description_target: "だし汁をたっぷり入れた、ふんわりやわらかい卵焼き" },
            { name: "Pickles", name_target: "お漬物", price: "¥200", description_target: "季節の野菜のぬか漬けや浅漬け" },
          ],
        },
        {
          name: "Western Breakfast",
          name_target: "洋朝食",
          items: [
            { name: "Toast Set", name_target: "トーストセット", price: "¥700", description_target: "厚切りトースト、サラダ、ゆで卵、コーヒーまたは紅茶のセット" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Drinks",
          name_target: "お飲み物",
          items: [
            { name: "Sencha Green Tea", name_target: "煎茶（上級）", price: "¥400", description_target: "静岡県産の上質な一番茶を70度のお湯でゆっくり抽出した、旨みと香りを最大限に引き出した煎茶" },
            { name: "Hojicha", name_target: "ほうじ茶", price: "¥350", description_target: "茶葉を強火で焙じた香ばしいお茶、カフェインが少なく胃に優しい — 朝食に最適" },
            { name: "Miso Soup", name_target: "お味噌汁", price: "¥250", description_target: "一番だしで仕立てた京都白味噌のお吸い物仕立て、豆腐とわかめ入り" },
          ],
        },
        {
          name: "Traditional Japanese Breakfast",
          name_target: "本格和朝食（定食）",
          items: [
            { name: "Complete Japanese Breakfast", name_target: "一汁三菜の和朝食", price: "¥1,800", description_target: "白ご飯・味噌汁・焼き魚（鮭または鯖）・だし巻き卵・小鉢（ほうれん草のおひたし）・漬物 — 一汁三菜は日本の伝統的な食事の基本形式" },
            { name: "Grilled Mackerel", name_target: "焼き鯖", price: "¥700", description_target: "脂ののった国産鯖に塩をふり、炭火でじっくり焼き上げた — 鯖の旨みと皮のパリッとした食感が朝食を豊かにする" },
            { name: "Natto with Rice", name_target: "納豆ご飯", price: "¥500", description_target: "水戸名産の大粒納豆に刻みネギと辛子をのせ、炊きたてご飯と — 発酵食品の代表格、日本の腸活の要" },
          ],
        },
        {
          name: "Light Breakfast",
          name_target: "軽朝食",
          items: [
            { name: "Ochazuke", name_target: "お茶漬け", price: "¥600", description_target: "ご飯に緑茶または出汁をかけて食べる軽食 — 具はサケ、梅干し、のりから選択可能。胃に優しく体に染み渡る一品" },
            { name: "Onigiri Set", name_target: "おにぎりセット", price: "¥700", description_target: "手握りおにぎり二個（具は昆布・鮭・梅から選択）と味噌汁のセット — コンビニでも売られているが店内での手握りは格別" },
          ],
        },
      ],
    },
  },

  mandarin: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "饮品",
          items: [
            { name: "Soy Milk", name_target: "豆浆", price: "¥8", description_target: "热豆浆或冷豆浆" },
            { name: "Rice Porridge", name_target: "粥", price: "¥12", description_target: "白粥或皮蛋瘦肉粥" },
            { name: "Tea", name_target: "茶", price: "¥6", description_target: "热茶" },
          ],
        },
        {
          name: "Breakfast",
          name_target: "早餐",
          items: [
            { name: "Fried Dough Stick", name_target: "油条", price: "¥5", description_target: "炸得金黄酥脆的油条" },
            { name: "Steamed Bun", name_target: "包子", price: "¥3", description_target: "猪肉或菜馅包子" },
            { name: "Boiled Egg", name_target: "煮鸡蛋", price: "¥3", description_target: "水煮鸡蛋" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Drinks",
          name_target: "饮品",
          items: [
            { name: "Freshly Ground Soy Milk", name_target: "现磨豆浆", price: "¥12", description_target: "用新鲜黄豆现磨现煮，可选甜味或无糖" },
            { name: "Congee", name_target: "白粥", price: "¥15", description_target: "用大米慢煮的清粥，搭配各种小菜" },
            { name: "Herbal Tea", name_target: "花草茶", price: "¥10", description_target: "菊花茶、玫瑰茶或枸杞茶" },
          ],
        },
        {
          name: "Dim Sum & Pastries",
          name_target: "点心与糕点",
          items: [
            { name: "Xiaolongbao", name_target: "小笼包", price: "¥28", description_target: "皮薄汤多的上海小笼包，一笼八个，蘸姜醋汁食用" },
            { name: "Pan-fried Dumplings", name_target: "锅贴", price: "¥18", description_target: "底部煎得金黄酥脆的猪肉白菜饺子" },
            { name: "Fried Dough Stick", name_target: "油条配豆浆", price: "¥12", description_target: "刚出锅的脆油条，撕开蘸豆浆吃 — 中国早餐黄金搭档" },
            { name: "Scallion Pancake", name_target: "葱油饼", price: "¥10", description_target: "层次分明的葱油千层饼，外酥内软" },
          ],
        },
        {
          name: "Congee & Noodles",
          name_target: "粥品与面食",
          items: [
            { name: "Century Egg Congee", name_target: "皮蛋瘦肉粥", price: "¥22", description_target: "粤式靓粥，皮蛋与瘦肉的经典组合，绵滑香浓" },
            { name: "Hot Dry Noodles", name_target: "热干面", price: "¥15", description_target: "武汉特色早点，碱水面条配芝麻酱、酱油、香醋和腌萝卜" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Drinks",
          name_target: "饮品",
          items: [
            { name: "Fresh Soy Milk", name_target: "现磨豆浆（无糖）", price: "¥15", description_target: "选用东北非转基因黄豆，石磨研磨后高温煮制，豆香浓郁 — 豆浆是中国传统早餐文化的核心，各地口味差异显著" },
            { name: "Cantonese Congee", name_target: "广式靓粥底", price: "¥20", description_target: "以猪骨、鱼骨和姜熬制数小时的浓郁粥底，加入配料后粥质绵滑如丝 — 粤式煲粥讲究火候与耐心" },
          ],
        },
        {
          name: "Shanghai Style",
          name_target: "沪式早点",
          items: [
            { name: "Xiaolongbao", name_target: "正宗上海小笼包", price: "¥35", description_target: "以精制猪皮冻为汤底，包入三分肥七分瘦的猪肉馅，用手工擀制薄皮包裹，蒸制七分钟即成 — 吃小笼包讲究'先开窗，后喝汤'的技巧" },
            { name: "Shengjianbao", name_target: "生煎馒头", price: "¥28", description_target: "上海本帮特色，底部煎制金黄、顶部撒芝麻和葱花的半发酵面皮包子，内有鲜肉与皮冻，一口汁水四溢" },
            { name: "Scallion Pancake", name_target: "葱油千层饼", price: "¥12", description_target: "以熟猪油抹层的面团反复折叠，加入大量青葱后煎制而成的层次丰富的饼 — 上海弄堂早餐的味觉记忆" },
          ],
        },
        {
          name: "Northern Style",
          name_target: "北方早点",
          items: [
            { name: "Jianbing", name_target: "煎饼果子", price: "¥15", description_target: "绿豆面糊摊饼，加鸡蛋、酱、辣椒酱，包入脆薄脆或油条 — 天津起源，流行于华北地区的标志性街头早餐" },
            { name: "Doubanjiang Noodles", name_target: "老北京炸酱面", price: "¥22", description_target: "将黄酱与肉末在猪油中慢慢熬制，浇在劲道的手擀面上，配时令菜码 — 北京人称之为'一碗炸酱面，走遍天下都不换'" },
          ],
        },
      ],
    },
  },

  korean: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "음료",
          items: [
            { name: "Barley Tea", name_target: "보리차", price: "무료", description_target: "따뜻한 보리차 (무료)" },
            { name: "Orange Juice", name_target: "오렌지 주스", price: "₩3,000", description_target: "신선한 오렌지 주스" },
            { name: "Milk", name_target: "우유", price: "₩2,500", description_target: "차가운 우유" },
          ],
        },
        {
          name: "Korean Breakfast",
          name_target: "한식 아침",
          items: [
            { name: "Rice", name_target: "밥", price: "₩1,000", description_target: "따뜻한 흰쌀밥" },
            { name: "Kimchi", name_target: "김치", price: "₩1,000", description_target: "배추김치" },
            { name: "Egg", name_target: "계란 프라이", price: "₩1,500", description_target: "계란 프라이" },
            { name: "Seaweed Soup", name_target: "미역국", price: "₩3,000", description_target: "따뜻한 미역국" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Drinks",
          name_target: "음료",
          items: [
            { name: "Barley Tea", name_target: "보리차", price: "무료", description_target: "구수한 보리차, 한국 식당에서 기본으로 제공" },
            { name: "Sikhye", name_target: "식혜", price: "₩3,000", description_target: "전통 한국 쌀 음료, 달콤하고 시원하게 마십니다" },
            { name: "Coffee", name_target: "아메리카노", price: "₩3,500", description_target: "진한 아메리카노, 한국에서 가장 인기 있는 커피" },
          ],
        },
        {
          name: "Korean Breakfast",
          name_target: "한식 아침 식사",
          items: [
            { name: "Doenjang Jjigae Set", name_target: "된장찌개 정식", price: "₩8,000", description_target: "따뜻한 된장찌개, 흰쌀밥, 김치와 나물 반찬이 포함된 정식" },
            { name: "Rice Porridge", name_target: "흰죽", price: "₩6,000", description_target: "부드러운 흰죽에 참기름과 소금으로 간을 한 담백한 죽" },
            { name: "Steamed Egg", name_target: "계란찜", price: "₩4,000", description_target: "뚝배기에 고슬고슬하게 쪄낸 부드러운 계란찜" },
            { name: "Mackerel Set", name_target: "고등어구이 정식", price: "₩9,000", description_target: "소금구이 고등어와 밥, 국, 반찬이 함께 나오는 아침 정식" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Drinks",
          name_target: "음료",
          items: [
            { name: "Barley Tea", name_target: "보리차", price: "무료", description_target: "구수한 보리차 — 한국의 모든 식당에서 기본으로 제공되는 웰컴 드링크로, 물 대신 마시는 전통 음료입니다" },
            { name: "Sikhye", name_target: "전통 식혜", price: "₩4,000", description_target: "엿기름으로 삭힌 한국 전통 발효 음료, 밥알이 동동 뜨고 달콤한 맛이 특징 — 소화를 돕는 식후 음료로도 즐겨 마십니다" },
          ],
        },
        {
          name: "Traditional Korean Breakfast",
          name_target: "전통 한식 아침 상",
          items: [
            { name: "Full Korean Breakfast", name_target: "한국식 아침 정식 (일곱 가지 반찬)", price: "₩15,000", description_target: "갓 지은 흰쌀밥, 된장찌개, 계절 나물 세 가지, 김치, 계란말이, 조림 반찬 — 한식의 기본 구성인 '일즙삼찬'의 정석" },
            { name: "Doenjang Jjigae", name_target: "전통 된장찌개", price: "₩8,000", description_target: "멸치와 다시마로 우려낸 육수에 집된장을 풀고, 두부·호박·버섯·감자를 넣어 자글자글 끓인 구수한 된장찌개 — 한국인의 소울푸드" },
            { name: "Grilled Dried Pollack", name_target: "북어구이 정식", price: "₩12,000", description_target: "황태를 고춧가루, 참기름, 마늘로 양념하여 구운 북어구이 — 숙취 해소와 원기 회복에 좋다고 알려진 한국인이 사랑하는 아침 메뉴" },
          ],
        },
        {
          name: "Light Breakfast",
          name_target: "가벼운 아침",
          items: [
            { name: "Congee", name_target: "전복죽 / 호박죽 선택", price: "₩10,000", description_target: "전복을 참기름에 볶다가 쌀과 함께 오랫동안 끓인 전복죽 또는 단호박을 곱게 갈아 만든 호박죽 — 든든하면서도 위에 부담이 없는 한국식 가벼운 아침" },
            { name: "Kimchi Jjigae", name_target: "김치찌개 정식", price: "₩9,000", description_target: "잘 익은 김치와 두툼한 삼겹살을 넣고 팔팔 끓인 김치찌개 — 한국인이 가장 좋아하는 찌개 1위, 흰쌀밥과 함께 먹으면 환상의 궁합" },
          ],
        },
      ],
    },
  },

  arabic: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "المشروبات",
          items: [
            { name: "Tea with Mint", name_target: "شاي بالنعناع", price: "15 جنيه", description_target: "شاي ساخن مع النعناع الطازج" },
            { name: "Fresh Juice", name_target: "عصير طازج", price: "20 جنيه", description_target: "عصير برتقال أو مانجو" },
            { name: "Coffee", name_target: "قهوة", price: "15 جنيه", description_target: "قهوة عربية أو تركية" },
          ],
        },
        {
          name: "Breakfast",
          name_target: "الفطور",
          items: [
            { name: "Hummus", name_target: "حمص", price: "20 جنيه", description_target: "حمص بالطحينة والليمون" },
            { name: "Labneh", name_target: "لبنة", price: "15 جنيه", description_target: "لبنة مع زيت الزيتون" },
            { name: "Pita Bread", name_target: "خبز عربي", price: "5 جنيه", description_target: "خبز عربي طازج" },
            { name: "Ful Medames", name_target: "فول مدمس", price: "18 جنيه", description_target: "فول بالليمون والثوم" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Hot Drinks",
          name_target: "المشروبات الساخنة",
          items: [
            { name: "Mint Tea", name_target: "شاي بالنعناع الطازج", price: "20 جنيه", description_target: "شاي أسود أو أخضر مع أوراق نعناع طازجة وسكر" },
            { name: "Arabic Coffee", name_target: "قهوة عربية بالهيل", price: "25 جنيه", description_target: "قهوة عربية فاتحة اللون محضّرة بالهيل، تقدّم مع التمر" },
            { name: "Turkish Coffee", name_target: "قهوة تركية", price: "20 جنيه", description_target: "قهوة مطبوخة على النار مع السكر، كثيفة وغنية النكهة" },
            { name: "Sage Tea", name_target: "شاي بالمريمية", price: "18 جنيه", description_target: "شاي أعشاب بنبتة المريمية، مفيد للجهاز الهضمي" },
          ],
        },
        {
          name: "Breakfast Spreads",
          name_target: "مائدة الفطور",
          items: [
            { name: "Ful Medames", name_target: "فول مدمس بالزيت والليمون", price: "25 جنيه", description_target: "فول مسلوق ومهروس مع زيت الزيتون، الليمون، الكمون والثوم — وجبة الفطور الأكثر شعبية في مصر ودول عربية عديدة" },
            { name: "Labneh", name_target: "لبنة بزيت الزيتون والزعتر", price: "22 جنيه", description_target: "لبنة كريمية مصفّاة مع زيت الزيتون البكر وخليط الزعتر والسمسم" },
            { name: "Shakshuka", name_target: "شكشوكة", price: "35 جنيه", description_target: "بيض مسلوق في صلصة طماطم حارة مع البصل والفليفلة — طبق الفطور الأكثر شهرة في شمال أفريقيا والمشرق" },
            { name: "Hummus with Pine Nuts", name_target: "حمص بالصنوبر", price: "30 جنيه", description_target: "حمص مع الطحينة محلّى بالصنوبر المقلي بالزبدة وبابريكا حمراء" },
          ],
        },
        {
          name: "Breads",
          name_target: "الخبز",
          items: [
            { name: "Pita Bread", name_target: "خبز عربي طازج", price: "8 جنيه", description_target: "خبز منفوخ من الفرن، يقدّم ساخناً ومناسب لتناوله مع المزة" },
            { name: "Manaqeesh", name_target: "مناقيش بالزعتر", price: "25 جنيه", description_target: "عجينة رقيقة مفرودة بخليط الزعتر وزيت الزيتون ومشوية في الفرن — الفطور الشعبي الأول في بلاد الشام" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Beverages",
          name_target: "المشروبات",
          items: [
            { name: "Cardamom Coffee", name_target: "القهوة العربية بالهيل والزعفران", price: "35 جنيه", description_target: "قهوة فاتحة اللون محضّرة من بُن مطحون خفيف التحميص مع الهيل والقليل من الزعفران — تقدّم في دلّة فضية مع التمر وفق التقليد الخليجي والبدوي، وهي رمز الكرم في الثقافة العربية" },
            { name: "Mint and Sage Tea", name_target: "مزيج شاي النعناع والمريمية", price: "25 جنيه", description_target: "خليط منعش من النعناع الطازج والمريمية البرية المجففة مع شاي أخضر صيني — يشرب بدون سكر لاستشعار تركيب النكهات" },
          ],
        },
        {
          name: "Levantine Breakfast Spread",
          name_target: "مائدة الفطور الشامية",
          items: [
            { name: "Full Mezze Breakfast", name_target: "الفطور الشامي الكامل", price: "120 جنيه", description_target: "مائدة غنية تشمل: حمص، فتوش، لبنة، زيتون أخضر وأسود، جبنة بيضاء، بيض مقلي، فول، مناقيش، وخبز عربي ساخن — الفطور الشامي يُعدّ وليمة كاملة تجمع العائلة على الطاولة صباحاً" },
            { name: "Shakshuka", name_target: "شكشوكة بالجبنة والفلفل الحار", price: "45 جنيه", description_target: "بيض مسلوق داخل صلصة طماطم طازجة مع البصل والثوم والكمون وبهارات السبع، يعلوها جبنة مبشورة وفلفل حار — أصولها تونسية وتحتفي بها اليوم كل المطابخ العربية" },
            { name: "Falafel", name_target: "فلافل بالطحينة", price: "30 جنيه", description_target: "أقراص فلافل مقرمشة من الفول الأخضر أو الحمص المطحون مع الأعشاب الطازجة، تقدّم مع طحينة وخبز عربي — يُعدّ الفلافل من أبرز مساهمات المطبخ العربي للعالم" },
          ],
        },
        {
          name: "Egyptian Specialties",
          name_target: "من المطبخ المصري",
          items: [
            { name: "Ful Medames", name_target: "الفول المدمس المصري الأصيل", price: "28 جنيه", description_target: "فول مطهو على نار هادئة طوال الليل في قِدر فخارية، يُهرس جزئياً ويُتبّل بزيت الزيتون والكمون والليمون والثوم — أكل مصر الأول منذ آلاف السنين" },
            { name: "Taameya", name_target: "طعمية (الفلافل المصري)", price: "25 جنيه", description_target: "تمييزاً عن فلافل الشام، الطعمية المصرية تصنع من الفول الأخضر المبلول المطحون بالأعشاب والتوابل، مقلية وهشّة من الخارج — مصر تعتبر نفسها الموطن الأصلي للفلافل" },
          ],
        },
      ],
    },
  },

  russian: {
    beginner: {
      sections: [
        {
          name: "Drinks",
          name_target: "Напитки",
          items: [
            { name: "Tea", name_target: "Чай", price: "80 руб.", description_target: "Горячий чай с сахаром" },
            { name: "Coffee", name_target: "Кофе", price: "150 руб.", description_target: "Горячий кофе" },
            { name: "Milk", name_target: "Молоко", price: "100 руб.", description_target: "Стакан молока" },
          ],
        },
        {
          name: "Breakfast",
          name_target: "Завтрак",
          items: [
            { name: "Porridge", name_target: "Каша", price: "200 руб.", description_target: "Горячая каша с маслом" },
            { name: "Pancakes", name_target: "Блины", price: "250 руб.", description_target: "Блины со сметаной или вареньем" },
            { name: "Bread with Butter", name_target: "Хлеб с маслом", price: "80 руб.", description_target: "Ржаной хлеб с маслом" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Drinks",
          name_target: "Напитки",
          items: [
            { name: "Black Tea", name_target: "Чёрный чай", price: "90 руб.", description_target: "Крепкий чёрный чай с сахаром и лимоном" },
            { name: "Coffee with Milk", name_target: "Кофе с молоком", price: "170 руб.", description_target: "Натуральный кофе с горячим молоком" },
            { name: "Kefir", name_target: "Кефир", price: "100 руб.", description_target: "Кефир жирностью 2,5% — традиционный утренний напиток" },
            { name: "Compote", name_target: "Компот из сухофруктов", price: "80 руб.", description_target: "Горячий компот из чернослива, кураги и изюма" },
          ],
        },
        {
          name: "Porridge & Cereals",
          name_target: "Каши и Злаки",
          items: [
            { name: "Buckwheat Porridge", name_target: "Гречневая каша", price: "220 руб.", description_target: "Рассыпчатая гречневая каша с маслом — самая любимая каша россиян" },
            { name: "Oatmeal", name_target: "Овсяная каша", price: "200 руб.", description_target: "Овсяная каша на молоке с мёдом и ягодами" },
            { name: "Millet Porridge", name_target: "Пшённая каша с тыквой", price: "230 руб.", description_target: "Пшённая каша с тыквой и маслом, посыпанная корицей" },
          ],
        },
        {
          name: "Traditional Dishes",
          name_target: "Традиционные блюда",
          items: [
            { name: "Blini with Sour Cream", name_target: "Блины со сметаной", price: "280 руб.", description_target: "Тонкие блины с жирной сметаной и вареньем из клубники или черники" },
            { name: "Syrniki", name_target: "Сырники со сметаной", price: "300 руб.", description_target: "Пышные творожники, обжаренные до золотистой корочки, со сметаной и вареньем" },
            { name: "Bread with Sausage", name_target: "Бутерброд с колбасой", price: "150 руб.", description_target: "Ржаной хлеб с докторской колбасой или сыром — классический советский завтрак" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Drinks",
          name_target: "Напитки",
          items: [
            { name: "Samovar Tea", name_target: "Чай из самовара", price: "120 руб.", description_target: "Крепкая заварка чёрного чая, разбавляемая кипятком из самовара по вкусу — традиция русского чаепития: чай пьют вприкуску с сахаром, с вареньем или мёдом" },
            { name: "Chicory with Milk", name_target: "Цикорий с молоком", price: "130 руб.", description_target: "Растворимый цикорий с горячим молоком — без кофеина, с мягким горьковатым вкусом. Популярен с советских времён как полезная альтернатива кофе" },
            { name: "Kefir", name_target: "Кефир", price: "110 руб.", description_target: "Кисломолочный напиток на основе кефирных грибков — неотъемлемая часть русского стола, полезен для микрофлоры кишечника и особенно ценится с утра" },
          ],
        },
        {
          name: "Porridges",
          name_target: "Каши",
          items: [
            { name: "Buckwheat Porridge", name_target: "Гречневая каша рассыпчатая", price: "260 руб.", description_target: "Гречка, поджаренная на сухой сковороде и сваренная в пропорции 1:2, с маслом сливочным — русский диетологи называют гречку 'королевой круп' за богатый состав микроэлементов" },
            { name: "Semolina", name_target: "Манная каша на молоке", price: "230 руб.", description_target: "Манная крупа, сваренная на цельном молоке до кремовой консистенции, с маслом и вареньем — у всех россиян связана с детством и воспоминаниями о бабушкиной кухне" },
          ],
        },
        {
          name: "Traditional Russian",
          name_target: "Традиционный русский завтрак",
          items: [
            { name: "Syrniki", name_target: "Сырники из домашнего творога", price: "350 руб.", description_target: "Пышные творожники из жирного деревенского творога с минимальным количеством муки, обжаренные на топлёном масле до румяной корочки — подаются со сметаной 30% и домашним вареньем" },
            { name: "Blini Set", name_target: "Блины с икрой и сметаной", price: "650 руб.", description_target: "Тонкие кружевные блины, выпеченные на раскалённой чугунной сковороде, с красной лососевой икрой и сметаной — блины символизируют солнце и являются главным блюдом Масленицы" },
            { name: "Pelmeni", name_target: "Пельмени по-сибирски", price: "420 руб.", description_target: "Сибирские пельмени с начинкой из говядины и свинины, отваренные в подсолённом бульоне и поданные с маслом и уксусом или сметаной — в Сибири пельмени едят даже на завтрак" },
          ],
        },
      ],
    },
  },
};

export const lunchMenus: Record<string, Record<string, MenuSections>> = {

  spanish: {
    beginner: {
      sections: [
        {
          name: "First Course",
          name_target: "Primer Plato",
          items: [
            { name: "Lentil Soup", name_target: "Sopa de lentejas", price: "€4.00", description_target: "Sopa caliente de lentejas" },
            { name: "Mixed Salad", name_target: "Ensalada mixta", price: "€4.00", description_target: "Lechuga, tomate y cebolla" },
            { name: "Pasta", name_target: "Macarrones", price: "€5.00", description_target: "Macarrones con salsa de tomate" },
          ],
        },
        {
          name: "Second Course",
          name_target: "Segundo Plato",
          items: [
            { name: "Grilled Chicken", name_target: "Pollo a la plancha", price: "€7.00", description_target: "Pollo con patatas fritas" },
            { name: "Grilled Fish", name_target: "Merluza a la plancha", price: "€8.00", description_target: "Merluza con verduras" },
            { name: "Pork Chop", name_target: "Chuleta de cerdo", price: "€7.00", description_target: "Chuleta con patatas" },
          ],
        },
        {
          name: "Dessert",
          name_target: "Postre",
          items: [
            { name: "Flan", name_target: "Flan de huevo", price: "incluido", description_target: "Flan casero con caramelo" },
            { name: "Fruit", name_target: "Fruta del tiempo", price: "incluido", description_target: "Fruta fresca de temporada" },
            { name: "Yogurt", name_target: "Yogur", price: "incluido", description_target: "Yogur natural" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Starters — First Course",
          name_target: "Primeros Platos",
          items: [
            { name: "Chickpea and Spinach Stew", name_target: "Potaje de garbanzos con espinacas", price: "€5.50", description_target: "Guiso tradicional de garbanzos con espinacas y bacalao, plato clásico del menú del día" },
            { name: "Gazpacho", name_target: "Gazpacho andaluz", price: "€5.00", description_target: "Sopa fría de tomate con pimiento y pepino — el entrante más refrescante del verano español" },
            { name: "Mixed Salad", name_target: "Ensalada mixta", price: "€4.50", description_target: "Lechuga, tomate, aceitunas, cebolla y atún con vinagreta de la casa" },
            { name: "Pasta with Tomato Sauce", name_target: "Macarrones con tomate casero", price: "€5.50", description_target: "Macarrones con salsa de tomate natural y un toque de albahaca" },
          ],
        },
        {
          name: "Second Course",
          name_target: "Segundos Platos",
          items: [
            { name: "Grilled Chicken", name_target: "Pollo a la plancha con patatas", price: "€8.50", description_target: "Pechuga de pollo a la plancha con patatas fritas y ensalada verde" },
            { name: "Hake", name_target: "Merluza a la romana", price: "€9.50", description_target: "Merluza rebozada en huevo y harina, frita hasta dorar — el pescado más popular del menú del día español" },
            { name: "Loin of Pork", name_target: "Lomo de cerdo en salsa", price: "€8.50", description_target: "Lomo de cerdo a la plancha con salsa de champiñones y patatas panaderas" },
          ],
        },
        {
          name: "Dessert",
          name_target: "Postre",
          items: [
            { name: "Egg Custard", name_target: "Flan de huevo casero", price: "incluido", description_target: "Flan elaborado artesanalmente con huevos y caramelo quemado" },
            { name: "Fresh Fruit", name_target: "Fruta del tiempo", price: "incluido", description_target: "Fruta fresca de temporada — melocotón, pera o naranja según la estación" },
            { name: "Crème Caramel", name_target: "Cuajada con miel", price: "incluido", description_target: "Cuajada de leche de oveja con miel y nueces" },
          ],
        },
        {
          name: "Set Price Includes",
          name_target: "El Menú incluye",
          items: [
            { name: "Bread, Water/Wine, Coffee", name_target: "Pan, agua o vino y café", price: "€12.00 menú completo", description_target: "El menú del día incluye primer plato, segundo, postre, pan, y bebida — una institución española del mediodía" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "First Course",
          name_target: "Primeros Platos",
          items: [
            { name: "Chickpea and Spinach Stew", name_target: "Potaje de garbanzos con espinacas y bacalao", price: "€7.00", description_target: "Guiso de garbanzos de Fuentesaúco con espinacas frescas y bacalao desalado, sazonado con comino, pimentón de la Vera y azafrán — plato de cuchara de la gastronomía castellana" },
            { name: "Salmorejo", name_target: "Salmorejo cordobés con jamón y huevo", price: "€6.50", description_target: "Crema espesa de tomate madurado al sol, pan de telera y AOVE, emulsionada hasta la perfección y coronada con jamón serrano picado y huevo duro rallado — más denso y untuoso que el gazpacho" },
            { name: "Menestra de verduras", name_target: "Menestra de verduras de temporada", price: "€7.00", description_target: "Guiso ligero de verduras de temporada cocinadas por separado y reunidas al final: alcachofas, guisantes, espárragos blancos y judías verdes en un sofrito de ajo y jamón" },
            { name: "Fideuà", name_target: "Fideuà de marisco", price: "€9.00", description_target: "Versión valenciana de la paella elaborada con fideos en lugar de arroz, con gambas, mejillones y calamar sobre un fondo de caldo de pescado y sofrito concentrado" },
          ],
        },
        {
          name: "Second Course",
          name_target: "Segundos Platos",
          items: [
            { name: "Braised Oxtail", name_target: "Rabo de toro estofado al Rioja", price: "€16.00", description_target: "Rabo de toro braseado durante horas en vino tinto de Rioja con verduras y especias hasta que la carne se desprende del hueso — plato emblemático de la cocina andaluza y cordobesa" },
            { name: "Grilled Sole", name_target: "Lenguado a la plancha con mantequilla de alcaparras", price: "€16.00", description_target: "Lenguado fresco del día cocinado a la plancha con aceite de oliva virgen extra y acompañado de una emulsión de mantequilla noisette con alcaparras y perejil" },
            { name: "Lamb Chops", name_target: "Chuletillas de cordero lechal a la brasa", price: "€18.00", description_target: "Chuletillas de cordero lechal asado en horno de leña o a la brasa, servidas con patatas a la panadera y pimientos de Padrón" },
          ],
        },
        {
          name: "Dessert",
          name_target: "Postres",
          items: [
            { name: "Homemade Flan", name_target: "Flan de yema de huevo con caramelo amargo", price: "€5.00", description_target: "Flan intenso elaborado solo con yemas de huevo campero, leche entera y vainilla natural, bañado con caramelo tostado ligeramente amargo" },
            { name: "Churros", name_target: "Churros de masa madre con chocolate de Villajoyosa", price: "€5.50", description_target: "Churros artesanales de masa madre, fritos en aceite de oliva virgen extra, acompañados de chocolate negro 70% de la chocolatera Valor de Villajoyosa" },
          ],
        },
        {
          name: "Set Menu Info",
          name_target: "Menú del Día",
          items: [
            { name: "Full Set Lunch", name_target: "Menú completo con vino de la casa", price: "€16.50", description_target: "El menú del día es la piedra angular de la cultura gastronómica española — primer plato, segundo, postre, pan artesanal, agua mineral y media botella de vino de la tierra o refresco incluidos. Servicio de lunes a viernes al mediodía" },
          ],
        },
      ],
    },
  },

  french: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "Entrées",
          items: [
            { name: "Green Salad", name_target: "Salade verte", price: "€6.00", description_target: "Salade fraîche avec vinaigrette" },
            { name: "Soup of the Day", name_target: "Soupe du jour", price: "€5.50", description_target: "Soupe chaude du jour" },
          ],
        },
        {
          name: "Main Courses",
          name_target: "Plats du Jour",
          items: [
            { name: "Grilled Chicken", name_target: "Poulet grillé", price: "€12.00", description_target: "Poulet avec légumes" },
            { name: "Pasta", name_target: "Pâtes au beurre", price: "€10.00", description_target: "Pâtes fraîches avec beurre et parmesan" },
            { name: "Fish of the Day", name_target: "Poisson du jour", price: "€13.00", description_target: "Poisson frais du marché" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Desserts",
          items: [
            { name: "Chocolate Mousse", name_target: "Mousse au chocolat", price: "€5.00", description_target: "Mousse légère au chocolat" },
            { name: "Crème Brûlée", name_target: "Crème brûlée", price: "€5.50", description_target: "Crème brûlée à la vanille" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "Entrées",
          items: [
            { name: "French Onion Soup", name_target: "Soupe à l'oignon gratinée", price: "€7.50", description_target: "Soupe à l'oignon avec croûtons et fromage fondu" },
            { name: "Caesar Salad", name_target: "Salade César", price: "€8.00", description_target: "Salade romaine, croûtons, parmesan et sauce César maison" },
            { name: "Charcuterie Board", name_target: "Assiette de charcuterie", price: "€9.00", description_target: "Saucisson sec, jambon de pays et terrine avec cornichons et moutarde" },
          ],
        },
        {
          name: "Daily Specials",
          name_target: "Plats du Jour",
          items: [
            { name: "Steak with Sauce", name_target: "Steak sauce au poivre", price: "€16.00", description_target: "Entrecôte grillée avec sauce au poivre vert et frites maison" },
            { name: "Duck Confit", name_target: "Confit de canard", price: "€17.00", description_target: "Cuisse de canard confite avec pommes sarladaises dorées" },
            { name: "Quiche Lorraine", name_target: "Quiche lorraine", price: "€11.00", description_target: "Tarte salée aux lardons et crème fraîche avec salade verte" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Desserts",
          items: [
            { name: "Crème Brûlée", name_target: "Crème brûlée à la vanille", price: "€6.50", description_target: "Crème onctueuse avec croûte de sucre caramélisé" },
            { name: "Apple Tart", name_target: "Tarte aux pommes fine", price: "€6.00", description_target: "Tarte fine aux pommes caramélisées avec crème fraîche" },
          ],
        },
        {
          name: "Set Lunch",
          name_target: "Formule Déjeuner",
          items: [
            { name: "Two-course Lunch", name_target: "Formule deux plats", price: "€18.00", description_target: "Entrée + plat ou plat + dessert, avec café inclus — la formule du midi par excellence" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "Entrées",
          items: [
            { name: "French Onion Soup", name_target: "Gratinée à l'oignon comme à Lyon", price: "€9.00", description_target: "Soupe aux oignons dorés au beurre avec cognac, gratinée avec emmental comté sous le gril — une spécialité des bouchons lyonnais, refuge des travailleurs au petit matin" },
            { name: "Salade Lyonnaise", name_target: "Salade lyonnaise aux lardons et œuf poché", price: "€10.00", description_target: "Frisée amère assaisonnée de vinaigrette au vieux vinaigre, surmontée de lardons fumés dorés et d'un œuf mollet poché — le plat signature de la cuisine des bouchons de Lyon" },
            { name: "Terrine du Chef", name_target: "Terrine de campagne du chef avec gelée de Sauternes", price: "€11.00", description_target: "Terrine maison de porc et veau avec pistaches et herbes, accompagnée d'une gelée légère au Sauternes et de cornichons au sel" },
          ],
        },
        {
          name: "Daily Plates",
          name_target: "Plats du Marché",
          items: [
            { name: "Bœuf Bourguignon", name_target: "Bœuf bourguignon braisé 6 heures", price: "€21.00", description_target: "Joue de bœuf braisée six heures dans un Bourgogne rouge avec oignons grelots, champignons de Paris, lardons fumés et carottes — la quintessence du plat mijoté français" },
            { name: "Sole Meunière", name_target: "Sole de la criée meunière", price: "€24.00", description_target: "Sole entière de la criée locale farinée et cuite au beurre noisette, dressée avec des câpres non-pareilles et du citron confit" },
            { name: "Magret de Canard", name_target: "Magret de canard du Périgord aux cerises et poivre de Sichuan", price: "€22.00", description_target: "Magret de canard rose saisi côté peau, avec sauce aux cerises acidulées et poivre de Sichuan — accord parfait entre la richesse du canard gras et la vivacité des fruits" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Desserts",
          items: [
            { name: "Tarte Tatin", name_target: "Tarte Tatin tiède aux pommes Reinette", price: "€8.50", description_target: "Pommes Reinette du Maine caramélisées au beurre et sucre roux, renversées sur pâte feuilletée pur beurre — servie tiède avec crème fraîche d'Isigny" },
            { name: "Île Flottante", name_target: "Île flottante à la praline rose", price: "€7.50", description_target: "Blancs d'œufs montés et pochés flottant sur crème anglaise à la vanille Bourbon, parsemés de pralines roses de Montélimar — spécialité lyonnaise" },
          ],
        },
        {
          name: "Set Lunch",
          name_target: "Formule Déjeuner du Marché",
          items: [
            { name: "Market Lunch", name_target: "Formule marché — trois plats", price: "€29.00", description_target: "Entrée, plat du jour et dessert choisis selon les arrivages du marché — le vrai déjeuner à la française, renouvelé chaque jour selon les saisons. Café et eau inclus" },
          ],
        },
      ],
    },
  },

  german: {
    beginner: {
      sections: [
        {
          name: "Soups",
          name_target: "Suppen",
          items: [
            { name: "Daily Soup", name_target: "Tagessuppe", price: "€4.50", description_target: "Suppe des Tages" },
            { name: "Goulash Soup", name_target: "Gulaschsuppe", price: "€5.50", description_target: "Gulaschsuppe mit Brot" },
          ],
        },
        {
          name: "Main Courses",
          name_target: "Hauptgerichte",
          items: [
            { name: "Schnitzel", name_target: "Schnitzel mit Pommes", price: "€13.00", description_target: "Wiener Schnitzel mit Pommes frites" },
            { name: "Roast Pork", name_target: "Schweinebraten", price: "€12.00", description_target: "Schweinebraten mit Knödel und Sauerkraut" },
            { name: "Currywurst", name_target: "Currywurst mit Pommes", price: "€9.00", description_target: "Bratwurst mit Currysauce und Pommes" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Nachspeisen",
          items: [
            { name: "Apple Cake", name_target: "Apfelkuchen", price: "€4.00", description_target: "Hausgemachter Apfelkuchen" },
            { name: "Ice Cream", name_target: "Eis", price: "€3.50", description_target: "Drei Kugeln Eis nach Wahl" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Soups",
          name_target: "Suppen",
          items: [
            { name: "Daily Soup", name_target: "Tagessuppe des Hauses", price: "€5.00", description_target: "Frisch zubereitete Suppe nach Saison — heute auf Anfrage" },
            { name: "Goulash Soup", name_target: "Ungarische Gulaschsuppe", price: "€6.50", description_target: "Kräftige Rindergulaschsuppe mit Paprika, Zwiebeln und Kümmel, serviert mit Bauernbrot" },
            { name: "Pea Soup", name_target: "Erbsensuppe mit Würstchen", price: "€6.00", description_target: "Sämige Erbsensuppe mit Speck und zwei Wiener Würstchen" },
          ],
        },
        {
          name: "Main Courses",
          name_target: "Hauptgerichte",
          items: [
            { name: "Schnitzel", name_target: "Wiener Schnitzel vom Kalb", price: "€18.00", description_target: "Klassisches Wiener Schnitzel vom Kalbfleisch, dünn geklopft und in Butterschmalz goldbraun gebacken, mit Kartoffelsalat und Preiselbeeren" },
            { name: "Sauerbraten", name_target: "Rheinischer Sauerbraten", price: "€16.00", description_target: "Im Essig marinierter Rinderbraten mit Rosinensoße, Rotkohl und Semmelknödeln — ein rheinisches Nationalgericht" },
            { name: "Currywurst", name_target: "Berliner Currywurst", price: "€9.50", description_target: "Gebratene Schweinewurst mit hausgemachter Currytomatensauce und Pommes frites — das Berliner Kultgericht" },
            { name: "Flammkuchen", name_target: "Elsässer Flammkuchen", price: "€11.00", description_target: "Dünner Teig mit Crème fraîche, Zwiebeln und Speck aus dem Holzofen — elsässische Spezialität" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Nachspeisen",
          items: [
            { name: "Black Forest Cake", name_target: "Schwarzwälder Kirschtorte", price: "€5.50", description_target: "Klassische Schwarzwälder Kirschtorte mit Schlagsahne, Kirschen und Kirschwasser" },
            { name: "Apple Strudel", name_target: "Apfelstrudel mit Vanillesauce", price: "€5.00", description_target: "Knuspriger Strudel mit Zimtäpfeln, Rosinen und Vanillesauce" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Soups",
          name_target: "Suppen",
          items: [
            { name: "Lentil Soup", name_target: "Schwäbische Linsensuppe mit Saitenwürstchen", price: "€7.00", description_target: "Sämige Linsensuppe nach schwäbischem Hausrezept mit Suppengemüse, Essig und zwei in der Suppe gargezogenen Saitenwürstchen — ein Klassiker der bürgerlichen deutschen Küche" },
            { name: "Goulash Soup", name_target: "Fränkische Gulaschsuppe mit Bauernbrot", price: "€8.00", description_target: "Kräftiger Rindereintopf mit Paprika, Tomaten und Majoran nach fränkischer Art, serviert mit selbst gebackenem Bauernbrot und Butter" },
          ],
        },
        {
          name: "Main Courses",
          name_target: "Hauptgerichte",
          items: [
            { name: "Sauerbraten", name_target: "Rheinischer Sauerbraten nach Düsseldorfer Art", price: "€22.00", description_target: "Rinderrücken 5 Tage in Essig, Rotwein, Zwiebeln und Gewürzen mariniert, dann geschmort und mit Rosinensoße, Rotkohl und selbst gemachten Semmelknödeln serviert — der Sauerbraten ist das kulinarische Aushängeschild des Rheinlands" },
            { name: "Maultaschen", name_target: "Schwäbische Maultaschen in Zwiebelbrühe", price: "€15.00", description_target: "Hausgemachte schwäbische Maultaschen mit Fleisch-Spinat-Füllung, serviert in einer klaren Rinderbrühe mit Röstzwiebeln — Maultaschen werden auch 'Herrgottsbscheißerle' genannt, da man das Fleisch darin vor Gott versteckte an Fastentagen" },
            { name: "Bavarian Roast Pork", name_target: "Bayerischer Schweinsbraten mit Kruste", price: "€19.00", description_target: "Schweineschulter mit knuspriger Schwarte, langsam im Bräter mit dunklem Bier geschmort, serviert mit Semmelknödeln und Blaukraut — das Herzstück bayerischer Wirtshausküche" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Nachspeisen",
          items: [
            { name: "Black Forest Cake", name_target: "Originale Schwarzwälder Kirschtorte", price: "€6.50", description_target: "Echter Schwarzwälder Kirschwasser aus Staufen, Morellokirschen, echte Schlagsahne und Schokoladenspäne — die offizielle Rezeptur verlangt mindestens 1,5cl Kirschwasser pro Portion, sonst darf sie den Namen nicht tragen" },
            { name: "Kaiserschmarrn", name_target: "Kaiserschmarrn nach Wiener Art", price: "€7.00", description_target: "Zerrissener, karamellisierter Palatschinkenteig mit Rosinen, bestäubt mit Puderzucker und serviert mit warmem Zwetschgenröster — ein österreichisch-bayerisches Dessert, das Kaiser Franz Joseph bevorzugt haben soll" },
          ],
        },
      ],
    },
  },

  italian: {
    beginner: {
      sections: [
        {
          name: "First Course",
          name_target: "Primo Piatto",
          items: [
            { name: "Spaghetti Bolognese", name_target: "Spaghetti al ragù", price: "€8.00", description_target: "Spaghetti con salsa di carne" },
            { name: "Risotto", name_target: "Risotto al parmigiano", price: "€9.00", description_target: "Risotto cremoso con parmigiano" },
            { name: "Minestrone", name_target: "Minestrone di verdure", price: "€6.00", description_target: "Zuppa di verdure miste" },
          ],
        },
        {
          name: "Second Course",
          name_target: "Secondo Piatto",
          items: [
            { name: "Grilled Chicken", name_target: "Pollo alla griglia", price: "€10.00", description_target: "Pollo con insalata" },
            { name: "Meatballs", name_target: "Polpette al sugo", price: "€9.00", description_target: "Polpette in salsa di pomodoro" },
            { name: "Grilled Fish", name_target: "Pesce alla griglia", price: "€12.00", description_target: "Pesce fresco del giorno" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Dolci",
          items: [
            { name: "Tiramisu", name_target: "Tiramisù", price: "€5.00", description_target: "Tiramisù fatto in casa" },
            { name: "Panna Cotta", name_target: "Panna cotta", price: "€4.50", description_target: "Panna cotta con frutti di bosco" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "First Course",
          name_target: "Primo Piatto",
          items: [
            { name: "Cacio e Pepe", name_target: "Spaghetti cacio e pepe", price: "€10.00", description_target: "Spaghetti romani con pecorino romano e pepe nero macinato fresco — semplicità assoluta" },
            { name: "Porcini Risotto", name_target: "Risotto ai porcini", price: "€13.00", description_target: "Riso Carnaroli mantecato con porcini freschi e parmigiano Reggiano 36 mesi" },
            { name: "Minestrone", name_target: "Minestrone della tradizione", price: "€7.00", description_target: "Zuppa densa di stagione con fagioli, zucchine, patate e verdure di campo" },
            { name: "Pappardelle", name_target: "Pappardelle al cinghiale", price: "€12.00", description_target: "Pasta fresca all'uovo con ragù di cinghiale al vino rosso, tipica della Toscana" },
          ],
        },
        {
          name: "Second Course",
          name_target: "Secondo Piatto",
          items: [
            { name: "Ossobuco", name_target: "Ossobuco alla milanese", price: "€18.00", description_target: "Stinco di vitello brasato con gremolata di prezzemolo, aglio e scorza di limone, servito con risotto allo zafferano" },
            { name: "Saltimbocca", name_target: "Saltimbocca alla romana", price: "€16.00", description_target: "Fettine di vitello con prosciutto crudo e salvia, saltate nel burro e vino bianco" },
            { name: "Branzino", name_target: "Branzino al forno con patate", price: "€17.00", description_target: "Spigola intera al forno con patate, olive, capperi e pomodorini" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Dolci",
          items: [
            { name: "Tiramisu", name_target: "Tiramisù della nonna", price: "€6.00", description_target: "Mascarpone montato con tuorli d'uovo, savoiardi inzuppati nel caffè ristretto e cacao amaro" },
            { name: "Panna Cotta", name_target: "Panna cotta al caramello salato", price: "€5.50", description_target: "Panna cotta di latte intero con un filo di caramello al sale di Cervia" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "First Course",
          name_target: "Primo Piatto",
          items: [
            { name: "Cacio e Pepe", name_target: "Spaghettone cacio e pepe in consistenze", price: "€13.00", description_target: "Spaghettone Martelli con pecorino romano stagionato 12 mesi emulsionato a freddo con l'acqua di cottura della pasta e pepe di Sarawak macinato al momento — la pasta romana per eccellenza, tre ingredienti, tecnica infinita" },
            { name: "Tortellini in Brodo", name_target: "Tortellini in brodo di cappone", price: "€14.00", description_target: "Tortellini bolognesi rigorosamente fatti a mano con ripieno di lombo di maiale, prosciutto crudo di Parma, mortadella IGP e parmigiano 24 mesi, serviti in brodo di cappone filtrato — la ricetta depositata alla Camera di Commercio di Bologna nel 1974" },
            { name: "Squid Ink Pasta", name_target: "Linguine al nero di seppia con mazzancolle", price: "€16.00", description_target: "Linguine nere al nero di seppia fresco con mazzancolle saltate all'aglio e prezzemolo in olio di oliva extravergine siciliano — la pasta del mare nel piatto" },
          ],
        },
        {
          name: "Second Course",
          name_target: "Secondo Piatto",
          items: [
            { name: "Florentine Steak", name_target: "Bistecca alla fiorentina", price: "€45.00 / kg", description_target: "Bistecca di vitellone di razza Chianina o Maremmana, taglio da 1,2 kg minimo, cotta alla brace a temperatura alta, servita al sangue — toccare la carne è obbligatorio, il sale solo dopo la cottura" },
            { name: "Lamb", name_target: "Agnello da latte alla scottadito", price: "€20.00", description_target: "Costolette di agnello da latte laziale grigliate sulla brace viva, mangiate calde con le dita — 'scottadito' indica che bruciano le dita, perché si mangiano appena tolte dal fuoco" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Dolci",
          items: [
            { name: "Cannolo", name_target: "Cannolo siciliano al momento", price: "€4.50", description_target: "Cialda fritta croccante riempita al momento del servizio con ricotta di pecora setacciata, gocce di cioccolato fondente e scorzetta d'arancia candita — il cannolo si riempie sul momento per mantenere la cialda croccante, mai prima" },
            { name: "Zabaione", name_target: "Zabaione al Marsala con pan di Spagna", price: "€7.00", description_target: "Crema soffice di tuorli d'uovo montati con zucchero e Marsala Superiore Florio, servita tiepida su pan di Spagna leggermente tostato — una delle preparazioni più antiche della pasticceria italiana" },
          ],
        },
      ],
    },
  },

  portuguese: {
    beginner: {
      sections: [
        {
          name: "Starters",
          name_target: "Entradas",
          items: [
            { name: "Soup of the Day", name_target: "Sopa do dia", price: "€2.50", description_target: "Sopa quente do dia" },
            { name: "Bread and Butter", name_target: "Pão e manteiga", price: "€1.50", description_target: "Pão com manteiga" },
          ],
        },
        {
          name: "Main Courses",
          name_target: "Pratos do Dia",
          items: [
            { name: "Grilled Chicken", name_target: "Frango grelhado", price: "€8.00", description_target: "Frango com batatas fritas" },
            { name: "Grilled Fish", name_target: "Peixe grelhado", price: "€9.00", description_target: "Peixe do dia grelhado" },
            { name: "Pork Chop", name_target: "Costeleta de porco", price: "€8.00", description_target: "Costeleta com arroz e feijão" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Sobremesas",
          items: [
            { name: "Custard Tart", name_target: "Pastel de nata", price: "€1.50", description_target: "Pastel de nata da casa" },
            { name: "Rice Pudding", name_target: "Arroz doce", price: "€2.50", description_target: "Arroz doce com canela" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Starters",
          name_target: "Entradas e Couvert",
          items: [
            { name: "Caldo Verde", name_target: "Caldo verde", price: "€3.50", description_target: "Sopa portuguesa de couve-galega com chouriço e batata — uma das sopas mais populares de Portugal" },
            { name: "Mixed Bread Basket", name_target: "Couvert variado", price: "€2.50", description_target: "Pão de trigo e broa de milho com manteiga, azeitonas e queijo da serra" },
            { name: "Shrimp Rissoles", name_target: "Rissóis de camarão", price: "€5.00", description_target: "Rissóis fritos recheados com camarão em molho béchamel" },
          ],
        },
        {
          name: "Daily Specials",
          name_target: "Pratos do Dia",
          items: [
            { name: "Salt Cod", name_target: "Bacalhau à Brás", price: "€13.00", description_target: "Bacalhau desfiado salteado com ovos mexidos, batata palha e azeitonas — um dos pratos de bacalhau mais populares de Portugal" },
            { name: "Grilled Sardines", name_target: "Sardinhas assadas", price: "€10.00", description_target: "Sardinhas frescas assadas na brasa, servidas com pimento assado e broa de milho" },
            { name: "Roast Pork", name_target: "Carne de porco à alentejana", price: "€12.00", description_target: "Carne de porco marinada com alho e vinho branco, salteada com amêijoas e coentros frescos" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Sobremesas",
          items: [
            { name: "Rice Pudding", name_target: "Arroz doce à portuguesa", price: "€3.50", description_target: "Arroz cremoso cozido em leite com casca de limão e canela, decorado com pó de canela" },
            { name: "Custard Tart", name_target: "Pastel de nata morno", price: "€1.50", description_target: "Pastel de massa folhada com creme de gemas, servido morno com canela" },
            { name: "Pudim Flan", name_target: "Pudim flan", price: "€3.00", description_target: "Pudim português de ovos e leite com calda de caramelo escuro" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "Entradas",
          items: [
            { name: "Caldo Verde", name_target: "Caldo verde transmontano", price: "€5.00", description_target: "Sopa rainha da gastronomia portuguesa: batata, couve-galega cortada em juliana finíssima, chouriço fumado de Trás-os-Montes e azeite virgem extra — servida em tigela de barro para manter a temperatura" },
            { name: "Amêijoas à Bulhão Pato", name_target: "Amêijoas à Bulhão Pato", price: "€14.00", description_target: "Amêijoas abertas no momento em azeite, alho laminado, coentros frescos e um fio de vinho branco Vinho Verde — receita inspirada no poeta lisboeta Bulhão Pato, que as apreciava imensamente" },
          ],
        },
        {
          name: "Main Courses",
          name_target: "Pratos Principais",
          items: [
            { name: "Bacalhau", name_target: "Bacalhau à Gomes de Sá", price: "€16.00", description_target: "Lascas de bacalhau demolhado cozinhado no forno com batata cozida, ovos cozidos, cebola, azeitonas pretas e azeite virgem extra — criado pelo comerciante José Luís Gomes de Sá no Porto do século XIX" },
            { name: "Roast Kid", name_target: "Cabrito assado no forno de barro", price: "€18.00", description_target: "Cabrito de raça Serrana assado lentamente em forno de barro com alho, vinho branco, colorau e azeite — especialidade transmontana e beirã para dias festivos e almoços de Páscoa" },
            { name: "Arroz de Pato", name_target: "Arroz de pato à moda do Minho", price: "€15.00", description_target: "Arroz gordo cozido no caldo de pato confitado, disposto em camadas alternadas com o pato desfiado e rodelas de chouriço fumado, gratinado no forno" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Sobremesas",
          items: [
            { name: "Serradura", name_target: "Serradura (pudim de bolacha)", price: "€4.50", description_target: "Sobremesa portuguesa de camadas alternadas de bolacha Maria esfarelada (a 'serradura') e creme de natas batidas com leite condensado — simples, indulgente e absolutamente irresistível" },
            { name: "Molotov", name_target: "Pudim Molotov com caramelo", price: "€5.00", description_target: "Pudim de claras batidas em neve, cozido no forno em banho-maria e regado com caramelo líquido — leve como uma nuvem e com sabor a caramelo profundo" },
          ],
        },
      ],
    },
  },

  japanese: {
    beginner: {
      sections: [
        {
          name: "Ramen & Noodles",
          name_target: "ラーメン・麺類",
          items: [
            { name: "Soy Sauce Ramen", name_target: "醤油ラーメン", price: "¥850", description_target: "醤油スープのラーメン" },
            { name: "Udon", name_target: "うどん", price: "¥750", description_target: "温かいうどん" },
            { name: "Soba", name_target: "そば", price: "¥800", description_target: "ざるそばまたは温かいそば" },
          ],
        },
        {
          name: "Rice Dishes",
          name_target: "ご飯もの",
          items: [
            { name: "Salmon Rice Bowl", name_target: "サーモン丼", price: "¥950", description_target: "サーモンの刺身をのせた丼" },
            { name: "Katsudon", name_target: "カツ丼", price: "¥900", description_target: "揚げカツと卵とじの丼" },
            { name: "Curry Rice", name_target: "カレーライス", price: "¥850", description_target: "日本風カレー" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Ramen",
          name_target: "ラーメン",
          items: [
            { name: "Tonkotsu Ramen", name_target: "とんこつラーメン", price: "¥980", description_target: "豚骨を長時間煮込んだ白濁スープのラーメン、チャーシューと煮卵付き" },
            { name: "Miso Ramen", name_target: "味噌ラーメン", price: "¥920", description_target: "北海道風の味噌スープ、コーンとバターをトッピング" },
            { name: "Shio Ramen", name_target: "塩ラーメン", price: "¥880", description_target: "あっさりした塩スープ、メンマとネギ付き" },
          ],
        },
        {
          name: "Set Meals",
          name_target: "定食",
          items: [
            { name: "Salmon Teishoku", name_target: "鮭の塩焼き定食", price: "¥1,100", description_target: "塩焼き鮭、ご飯、味噌汁、漬物、小鉢のセット" },
            { name: "Tonkatsu Set", name_target: "とんかつ定食", price: "¥1,200", description_target: "厚切りとんかつとキャベツの千切り、ご飯と味噌汁のセット" },
            { name: "Sashimi Set", name_target: "刺身定食", price: "¥1,400", description_target: "本日の刺身盛り合わせ、ご飯、味噌汁のセット" },
          ],
        },
        {
          name: "Rice Bowls",
          name_target: "丼もの",
          items: [
            { name: "Unaju", name_target: "うな重", price: "¥2,200", description_target: "国産うなぎの蒲焼を白いご飯の上にのせた重箱 — 夏の土用の丑の日に食べる伝統的な一品" },
            { name: "Oyakodon", name_target: "親子丼", price: "¥900", description_target: "鶏肉とたまねぎを甘辛い出汁で煮て、卵でとじた丼" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Ramen",
          name_target: "ラーメン",
          items: [
            { name: "Premium Tonkotsu", name_target: "特製とんこつラーメン", price: "¥1,200", description_target: "20時間以上煮込んだ豚骨スープに、低温調理のチャーシュー、味付け煮卵、メンマ、青ねぎを添えた一杯 — 博多から発祥したとんこつラーメンは今や日本のラーメン文化を世界に広めた代表格" },
            { name: "Tsukemen", name_target: "つけ麺", price: "¥1,100", description_target: "濃厚な豚骨魚介つけ汁に太麺をつけて食べるスタイル — ざる感覚で楽しむ夏も冬も人気のラーメンの派生形" },
          ],
        },
        {
          name: "Set Meals",
          name_target: "本格定食",
          items: [
            { name: "Grilled Yellowtail Set", name_target: "ぶりの照り焼き定食", price: "¥1,600", description_target: "脂ののった国産ぶりに醤油、みりん、酒を合わせたタレを塗り、こんがり焼いた照り焼き — 炊きたてご飯、赤だし、お新香のセット付き" },
            { name: "Katsu Curry", name_target: "カツカレー定食", price: "¥1,400", description_target: "玉ねぎと野菜を丁寧に炒め、スパイスで仕上げた本格カレーにサクサクのとんかつをのせた一品 — 洋食の影響を受けた日本独自の進化を遂げた国民食" },
            { name: "Soba Tempura Set", name_target: "天ざる蕎麦", price: "¥1,800", description_target: "石臼挽きの二八蕎麦を冷たいかけ汁でいただく盛り蕎麦に、海老と野菜の天ぷらを添えた一品 — 江戸の食文化を今に伝える蕎麦の醍醐味" },
          ],
        },
        {
          name: "Rice Bowls",
          name_target: "丼もの",
          items: [
            { name: "Unajuu", name_target: "うな重 (国産うなぎ)", price: "¥3,500", description_target: "国産うなぎを白焼きにした後、蒸して脂を抜き、自家製タレで何度も焼きながら丁寧に仕上げた蒲焼を、特上のご飯の上にのせた重箱 — 日本の贅沢ランチの代名詞" },
          ],
        },
      ],
    },
  },

  mandarin: {
    beginner: {
      sections: [
        {
          name: "Soups",
          name_target: "汤品",
          items: [
            { name: "Tomato Egg Soup", name_target: "番茄蛋花汤", price: "¥15", description_target: "番茄和鸡蛋的汤" },
            { name: "Hot and Sour Soup", name_target: "酸辣汤", price: "¥18", description_target: "酸辣口味的汤" },
          ],
        },
        {
          name: "Rice & Noodles",
          name_target: "饭面",
          items: [
            { name: "Fried Rice", name_target: "扬州炒饭", price: "¥22", description_target: "鸡蛋炒饭" },
            { name: "Beef Noodle Soup", name_target: "牛肉面", price: "¥28", description_target: "牛肉和面条的汤" },
            { name: "Dumplings", name_target: "饺子", price: "¥20", description_target: "猪肉或蔬菜饺子" },
          ],
        },
        {
          name: "Main Dishes",
          name_target: "主菜",
          items: [
            { name: "Sweet and Sour Pork", name_target: "糖醋里脊", price: "¥30", description_target: "甜酸口味的猪肉" },
            { name: "Mapo Tofu", name_target: "麻婆豆腐", price: "¥22", description_target: "辣味豆腐" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Set Meals",
          name_target: "套餐",
          items: [
            { name: "Business Set Meal", name_target: "商务套餐", price: "¥58", description_target: "汤 + 主菜 + 米饭 + 小菜，适合午休快速用餐" },
            { name: "Working Lunch", name_target: "工作餐", price: "¥35", description_target: "三菜一汤套餐，分量足，出餐快" },
          ],
        },
        {
          name: "Noodles & Rice",
          name_target: "面食与米饭",
          items: [
            { name: "Lanzhou Beef Noodle", name_target: "兰州拉面", price: "¥28", description_target: "手拉细面在清汤牛肉汤底中，配大片牛腱、萝卜和辣椒油 — 中国最受欢迎的面食之一" },
            { name: "Braised Pork Rice", name_target: "卤肉饭", price: "¥25", description_target: "五花肉卤制入味后淋在白米饭上，配腌黄瓜和卤蛋" },
            { name: "Dan Dan Noodles", name_target: "担担面", price: "¥22", description_target: "四川特色，芝麻酱、辣椒油和花椒拌面，配碎肉和青菜" },
          ],
        },
        {
          name: "Signature Dishes",
          name_target: "招牌菜",
          items: [
            { name: "Kung Pao Chicken", name_target: "宫保鸡丁", price: "¥35", description_target: "鸡胸肉丁配花生米、干辣椒、花椒炒制，源自贵州的四川名菜" },
            { name: "Mapo Tofu", name_target: "麻婆豆腐", price: "¥28", description_target: "嫩豆腐配肉末在麻辣豆瓣酱中烹制，花椒和豆豉调味 — 四川料理的标志" },
            { name: "Three Cup Chicken", name_target: "三杯鸡", price: "¥38", description_target: "台湾名菜，鸡肉用一杯米酒、一杯麻油、一杯酱油和九层塔慢煮入味" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Soup",
          name_target: "汤",
          items: [
            { name: "Cantonese Slow-Cooked Soup", name_target: "广东靓汤（老火汤）", price: "¥45", description_target: "选用新鲜猪骨或鸡架，配红枣、枸杞、淮山等滋补食材，文火慢煲三至四小时 — 广东人深信老火汤养生补虚，每天必喝" },
          ],
        },
        {
          name: "Regional Specialties",
          name_target: "地方名菜",
          items: [
            { name: "Dongpo Pork", name_target: "东坡肉", price: "¥58", description_target: "整块带皮五花肉用绍兴黄酒、老抽、冰糖和香料慢炖三小时，皮弹肉酥、入口即化 — 相传由北宋大文豪苏东坡在杭州为官时所创，流传千年" },
            { name: "West Lake Fish in Vinegar", name_target: "西湖醋鱼", price: "¥68", description_target: "选用西湖草鱼，先汆水后用镇江香醋、糖和酱油调制的酸甜汁浇淋 — 杭帮菜的代表，乾隆皇帝南巡时也为之折服" },
            { name: "Beggar's Chicken", name_target: "叫化童子鸡", price: "¥88", description_target: "整鸡腹内填入火腿、冬菇、冬笋等馅料，用荷叶包裹再覆以黄泥，慢烤四至六小时 — 相传为叫花子所创，如今是杭州高档餐厅的必点名菜" },
          ],
        },
        {
          name: "Noodles",
          name_target: "面食",
          items: [
            { name: "Authentic Dan Dan Noodles", name_target: "成都正宗担担面", price: "¥32", description_target: "细碱水面配宜宾芽菜、郫县豆瓣炒香的猪肉末、芝麻酱、花椒油和辣椒油 — 担担面得名于早年在成都街头走街串巷用竹担挑着叫卖的小贩" },
          ],
        },
      ],
    },
  },

  korean: {
    beginner: {
      sections: [
        {
          name: "Soups & Stews",
          name_target: "국·찌개",
          items: [
            { name: "Kimchi Jjigae", name_target: "김치찌개", price: "₩8,000", description_target: "김치와 두부 찌개" },
            { name: "Doenjang Jjigae", name_target: "된장찌개", price: "₩8,000", description_target: "된장 찌개" },
            { name: "Seolleongtang", name_target: "설렁탕", price: "₩10,000", description_target: "소뼈 국물" },
          ],
        },
        {
          name: "Rice Dishes",
          name_target: "밥·면",
          items: [
            { name: "Bibimbap", name_target: "비빔밥", price: "₩9,000", description_target: "채소와 계란, 고추장 비빔밥" },
            { name: "Bulgogi Rice Bowl", name_target: "불고기 덮밥", price: "₩10,000", description_target: "불고기와 밥" },
            { name: "Japchae", name_target: "잡채", price: "₩9,000", description_target: "당면과 채소 볶음" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Soups & Stews",
          name_target: "국·탕·찌개",
          items: [
            { name: "Kimchi Jjigae", name_target: "묵은지 김치찌개", price: "₩9,000", description_target: "잘 익은 묵은지와 삼겹살을 넣어 끓인 진한 김치찌개, 두부와 파 고명 위에" },
            { name: "Galbitang", name_target: "갈비탕", price: "₩14,000", description_target: "소갈비를 오래 끓여 맑은 국물에 무와 당면을 넣은 깔끔한 국" },
            { name: "Sundubu Jjigae", name_target: "순두부찌개", price: "₩9,000", description_target: "부드러운 순두부에 조개, 새우, 고추장을 넣어 끓인 얼큰한 찌개" },
          ],
        },
        {
          name: "Rice & Noodles",
          name_target: "밥·면",
          items: [
            { name: "Bibimbap", name_target: "돌솥비빔밥", price: "₩11,000", description_target: "뜨거운 돌솥에 담긴 비빔밥으로 밑바닥에 누룽지가 생기는 것이 특징, 다양한 나물과 고추장" },
            { name: "Mul Naengmyeon", name_target: "물냉면", price: "₩10,000", description_target: "평양식 동치미 국물의 차가운 냉면, 편육과 오이, 삶은 달걀 고명" },
            { name: "Bulgogi Jeongol", name_target: "불고기 전골", price: "₩15,000", description_target: "달콤한 양념 불고기와 버섯, 당면이 어우러진 냄비 요리, 2인 기준" },
          ],
        },
        {
          name: "Grilled",
          name_target: "구이",
          items: [
            { name: "Samgyeopsal", name_target: "삼겹살 구이", price: "₩15,000", description_target: "두툼한 삼겹살을 테이블 그릴에 직접 구워 쌈채소에 마늘, 쌈장과 싸먹는 한국식 바베큐" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Soups",
          name_target: "국·탕",
          items: [
            { name: "Gomtang", name_target: "사골곰탕", price: "₩14,000", description_target: "소의 사골과 잡뼈를 12시간 이상 고아 만든 진하고 뽀얀 국물 — 한국의 보양식 문화에서 가장 중요한 자리를 차지하며, 국물에 깍두기 국물을 섞어 먹는 것이 진정한 매니아의 방식" },
            { name: "Haemul Sundubu", name_target: "해물 순두부찌개 (뚝배기)", price: "₩12,000", description_target: "바지락, 새우, 홍합 등 신선한 해물과 국산 생순두부를 고춧가루 양념에 팔팔 끓인 찌개 — 뚝배기째 상에 올라와 마지막 한 술까지 뜨겁게 먹을 수 있는 한국 겨울의 맛" },
          ],
        },
        {
          name: "Rice & Noodles",
          name_target: "밥·면",
          items: [
            { name: "Dolsot Bibimbap", name_target: "산채 돌솥비빔밥", price: "₩13,000", description_target: "강원도 산나물(고사리, 도라지, 취나물, 시래기)을 직접 무쳐 달군 돌솥에 담아낸 비빔밥 — 돌솥 바닥에 생기는 누룽지를 물에 불려 숭늉으로 마무리하는 것이 정석" },
            { name: "Bibim Naengmyeon", name_target: "함흥 비빔냉면", price: "₩12,000", description_target: "고구마 전분으로 만든 쫄깃한 함흥냉면에 고추장 양념, 오이채, 배, 삶은 달걀을 올린 것 — 평양냉면이 담백하다면 함흥냉면은 매콤하고 강렬한 맛" },
          ],
        },
        {
          name: "Korean BBQ",
          name_target: "구이",
          items: [
            { name: "Premium Hanwoo Galbi", name_target: "한우 갈비 구이", price: "₩35,000", description_target: "1++ 등급 한우 갈비를 전통 양념(배, 사과, 간장, 참기름)에 최소 24시간 재워 숯불에 구운 최고급 갈비 — 한우 갈비구이는 한국에서 가장 특별한 날에 먹는 음식으로, 생일과 명절 상에 빠지지 않는다" },
            { name: "Samgyeopsal with Kimchi", name_target: "김치 삼겹살", price: "₩16,000", description_target: "숙성 삼겹살과 신 묵은지를 함께 구워 쌈장, 마늘, 파채와 함께 상추와 깻잎에 싸먹는 방식 — 한국 회식 문화의 핵심이자 외국인들이 가장 사랑하는 한국 음식" },
          ],
        },
      ],
    },
  },

  arabic: {
    beginner: {
      sections: [
        {
          name: "Soups",
          name_target: "الشوربات",
          items: [
            { name: "Lentil Soup", name_target: "شوربة العدس", price: "25 جنيه", description_target: "شوربة العدس الدافئة" },
            { name: "Vegetable Soup", name_target: "شوربة الخضروات", price: "20 جنيه", description_target: "شوربة خضروات طازجة" },
          ],
        },
        {
          name: "Main Courses",
          name_target: "الأطباق الرئيسية",
          items: [
            { name: "Grilled Chicken", name_target: "دجاج مشوي", price: "60 جنيه", description_target: "دجاج مشوي مع أرز" },
            { name: "Kofta", name_target: "كفتة مشوية", price: "55 جنيه", description_target: "كفتة لحم مع خبز" },
            { name: "Stuffed Vine Leaves", name_target: "ورق عنب", price: "45 جنيه", description_target: "ورق عنب بالأرز واللحم" },
          ],
        },
        {
          name: "Sides",
          name_target: "المقبلات",
          items: [
            { name: "Hummus", name_target: "حمص", price: "20 جنيه", description_target: "حمص بالطحينة" },
            { name: "Tabbouleh", name_target: "تبولة", price: "22 جنيه", description_target: "سلطة البقدونس والبرغل" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "Soups & Starters",
          name_target: "الشوربات والمقبلات",
          items: [
            { name: "Red Lentil Soup", name_target: "شوربة العدس بالكمون والليمون", price: "30 جنيه", description_target: "شوربة عدس أحمر ناعمة مع الكمون والكركم وعصير الليمون الطازج — أساس المطبخ العربي من المشرق إلى المغرب" },
            { name: "Mezze Platter", name_target: "طبق المزة المشكل", price: "75 جنيه", description_target: "تشكيلة من الحمص، المتبل، الورق عنب، الفتوش والزيتون — المزة هي فن الاستمتاع بالطعام الجماعي في الثقافة العربية" },
            { name: "Fattoush", name_target: "فتوش بالرمان", price: "28 جنيه", description_target: "سلطة خضراء مع خبز محمص وصلصة الرمان والدبس — الفتوش أصله شامي وهو رمز الابتكار في استخدام بقايا الخبز" },
          ],
        },
        {
          name: "Main Courses",
          name_target: "الأطباق الرئيسية",
          items: [
            { name: "Mixed Grill", name_target: "مشاوي مشكلة", price: "120 جنيه", description_target: "تشكيلة من الكباب والكفتة والشاورما وفيليه الدجاج المشوي، تقدّم مع الخبز العربي والمزة" },
            { name: "Mansaf", name_target: "منسف بالجميد", price: "85 جنيه", description_target: "أرز مع لحم الغنم المطهو في صلصة اللبن المجفف (الجميد) — الطبق الوطني الأردني، يؤكل تقليدياً باليد في المجالس" },
            { name: "Moussaka", name_target: "مسقعة", price: "65 جنيه", description_target: "طبقات من الباذنجان المقلي مع اللحم المفروم وصلصة الطماطم في الفرن — منتشرة في مصر وبلاد الشام واليونان بنسخ مختلفة" },
          ],
        },
        {
          name: "Bread",
          name_target: "الخبز",
          items: [
            { name: "Arabic Bread", name_target: "خبز عربي طازج", price: "5 جنيه", description_target: "خبز منفوخ طازج من الفرن" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "Starters",
          name_target: "المقبلات",
          items: [
            { name: "Full Mezze", name_target: "مائدة المزة الكاملة", price: "180 جنيه", description_target: "عشرة أطباق مزة تشمل: حمص، متبل، لبنة، ورق عنب، كبة نيئة، كباب عنابي، كيش، فتوش، سلطة الخضار والزيتون المتبل — المزة في الثقافة الشامية لا تُعجّل، إنها تجربة اجتماعية تمتد لساعات" },
          ],
        },
        {
          name: "Main Courses",
          name_target: "الأطباق الرئيسية",
          items: [
            { name: "Ouzi Lamb", name_target: "عوزي الخروف على الأرز", price: "250 جنيه", description_target: "خروف كامل محشو بالأرز والمكسرات والبهارات العربية، مطهو ببطء في الفرن حتى تتفتت العظام — العوزي هو طبق الأفراح والمناسبات الكبرى في الخليج وبلاد الشام" },
            { name: "Baked Fish with Rice", name_target: "سيباس مشوي على السياخ مع أرز الصيادية", price: "95 جنيه", description_target: "سمك سيباس طازج متبل بالثوم والكمون والكزبرة، مشوي على الفحم، يقدّم مع أرز الصيادية المطهو بمرق السمك والبصل المكرمل" },
            { name: "Kofta in Tomato Sauce", name_target: "كفتة بالصلصة داوود باشا", price: "75 جنيه", description_target: "كرات من الكفتة المشوية مطهوة في صلصة طماطم غنية مع الصنوبر والبهار الحلو — طبق من مطبخ الحقبة العثمانية لا يزال محبوباً في سوريا ولبنان والأردن" },
          ],
        },
        {
          name: "Desserts",
          name_target: "الحلويات",
          items: [
            { name: "Kunafa", name_target: "كنافة نابلسية بالجبنة العكاوية", price: "45 جنيه", description_target: "طبقة من خيوط الكنافة الرفيعة مع جبنة عكاوية غير مملحة، مشبعة بالقطر وماء الزهر، مرشوشة بالفستق الحلبي — كنافة نابلس لها حضور أسطوري في تاريخ الحلويات العربية" },
            { name: "Baklava", name_target: "بقلاوة دمشقية بالفستق الحلبي", price: "55 جنيه", description_target: "طبقات رقيقة من عجينة الفيلو مع الفستق الحلبي المطحون، مشبعة بالسمن البلدي والقطر المطيّب بماء الورد وماء الزهر — الحلويات التركية الأصل التي غدت هوية للمطبخ العربي الشامي" },
          ],
        },
      ],
    },
  },

  russian: {
    beginner: {
      sections: [
        {
          name: "Soups",
          name_target: "Первые блюда",
          items: [
            { name: "Borscht", name_target: "Борщ", price: "250 руб.", description_target: "Свекольный суп со сметаной" },
            { name: "Chicken Soup", name_target: "Куриный суп", price: "220 руб.", description_target: "Суп с курицей и овощами" },
          ],
        },
        {
          name: "Main Courses",
          name_target: "Второе блюдо",
          items: [
            { name: "Pelmeni", name_target: "Пельмени", price: "320 руб.", description_target: "Пельмени со сметаной" },
            { name: "Cutlet", name_target: "Котлета с пюре", price: "280 руб.", description_target: "Мясная котлета с картофельным пюре" },
            { name: "Golubtsy", name_target: "Голубцы", price: "300 руб.", description_target: "Фаршированная капуста с мясом и рисом" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Десерты",
          items: [
            { name: "Kompot", name_target: "Компот", price: "80 руб.", description_target: "Фруктовый компот" },
            { name: "Jam Pancakes", name_target: "Блины с вареньем", price: "180 руб.", description_target: "Блины с домашним вареньем" },
          ],
        },
      ],
    },
    intermediate: {
      sections: [
        {
          name: "First Course — Soups",
          name_target: "Первое блюдо — Супы",
          items: [
            { name: "Ukrainian Borscht", name_target: "Борщ украинский со сметаной", price: "280 руб.", description_target: "Наваристый борщ из свёклы, капусты, картофеля, моркови и томата со свиными рёбрышками, подаётся со сметаной и пышками" },
            { name: "Shchi", name_target: "Щи из свежей капусты", price: "250 руб.", description_target: "Лёгкий суп из свежей белокочанной капусты с картофелем и морковью — русский суп №2 после борща" },
            { name: "Solyanka", name_target: "Сборная мясная солянка", price: "320 руб.", description_target: "Кислый суп с мясной нарезкой, солёными огурцами, маслинами и лимоном — богатый вкус пяти видов мяса" },
          ],
        },
        {
          name: "Second Course",
          name_target: "Второе блюдо",
          items: [
            { name: "Beef Stroganoff", name_target: "Бефстроганов с картофельным пюре", price: "420 руб.", description_target: "Нежные полоски говядины в сливочном соусе с горчицей и сметаной, подаются с воздушным картофельным пюре" },
            { name: "Pelmeni", name_target: "Сибирские пельмени с уксусом", price: "340 руб.", description_target: "Пельмени ручной лепки с начинкой из говядины и свинины, подаются с маслом, уксусом или сметаной" },
            { name: "Stuffed Cabbage", name_target: "Голубцы в томатном соусе", price: "320 руб.", description_target: "Листья белокочанной капусты, фаршированные смесью риса и фарша, тушённые в томатном соусе со сметаной" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Десерты",
          items: [
            { name: "Honey Cake", name_target: "Медовик", price: "220 руб.", description_target: "Многослойный медовый торт с кремом из сметаны — один из самых любимых тортов в России" },
            { name: "Napoleon Cake", name_target: "Торт «Наполеон»", price: "230 руб.", description_target: "Хрустящие слои слоёного теста с заварным кремом — классика советской кондитерской" },
          ],
        },
      ],
    },
    advanced: {
      sections: [
        {
          name: "First Course",
          name_target: "Первое блюдо",
          items: [
            { name: "Classic Borscht", name_target: "Борщ классический со шпинатом и чесночными пампушками", price: "350 руб.", description_target: "Насыщенный борщ на говяжьем бульоне с томлёной свёклой, квашеной капустой и свиной рулькой, поданный с деревенской сметаной и чесночными пампушками — дискуссия об украинском или русском происхождении борща не утихает, но его любят везде одинаково" },
            { name: "Ukha", name_target: "Тройная уха по-царски", price: "390 руб.", description_target: "Тройной рыбный бульон из судака, щуки и осетрины с картофелем, луком и петрушкой — уха варится поэтапно, каждая рыба закладывается в своё время, что формирует многогранный вкус бульона" },
          ],
        },
        {
          name: "Second Course",
          name_target: "Второе блюдо",
          items: [
            { name: "Beef Stroganoff", name_target: "Классический бефстроганов", price: "520 руб.", description_target: "Вырезка из говядины, нарезанная тонкой соломкой и обжаренная до золотистой корочки, затем тушённая в соусе из сметаны, горчицы и лука — рецепт разработан французским поваром семьи Строгановых в XIX веке, один из самых узнаваемых русских блюд в мире" },
            { name: "Chicken Kiev", name_target: "Котлета по-киевски с зелёным маслом", price: "480 руб.", description_target: "Куриная грудка, отбитая, завёрнутая вокруг сливочного масла с чесноком и петрушкой, запанированная и обжаренная — при разрезании вытекает ароматное зелёное масло, которое является главной прелестью блюда" },
            { name: "Duck with Apples", name_target: "Утка с антоновскими яблоками и гречкой", price: "650 руб.", description_target: "Утка, маринованная в специях и запечённая с кислыми антоновскими яблоками, нарезанными пластами, — кислота яблок разрушает жир птицы, делая мясо нежным. Подаётся с рассыпчатой гречневой кашей" },
          ],
        },
        {
          name: "Desserts",
          name_target: "Десерты",
          items: [
            { name: "Honey Cake", name_target: "Медовик домашний со сметанным кремом", price: "280 руб.", description_target: "Девять тонких коржей, выпеченных с мёдом и содой до карамельного цвета, прослоённых кремом из домашней сметаны с сахаром и ванилью — медовику требуется ночь в холодильнике, чтобы коржи пропитались и стали нежными" },
            { name: "Bird's Milk", name_target: "Торт «Птичье молоко»", price: "290 руб.", description_target: "Суфле из яичного белка и агар-агара между двумя тонкими бисквитными коржами, покрытое тёмным шоколадом — торт был разработан московским рестораном «Прага» в 1978 году и за ним выстраивались многочасовые очереди в советское время" },
          ],
        },
      ],
    },
  },
};

export const menuTitleByLanguage: Record<string, Record<string, string>> = {
  spanish:    { breakfast: 'Desayuno', lunch: 'Menú del Día', dinner: 'Carta' },
  french:     { breakfast: 'Petit-déjeuner', lunch: 'Menu du Déjeuner', dinner: 'Carte' },
  german:     { breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Speisekarte' },
  italian:    { breakfast: 'Prima Colazione', lunch: 'Pranzo', dinner: 'Menu' },
  portuguese: { breakfast: 'Pequeno-almoço', lunch: 'Ementa do Dia', dinner: 'Ementa' },
  japanese:   { breakfast: '朝食メニュー', lunch: 'ランチメニュー', dinner: 'ディナーメニュー' },
  mandarin:   { breakfast: '早餐菜单', lunch: '午餐菜单', dinner: '晚餐菜单' },
  korean:     { breakfast: '아침 식사 메뉴', lunch: '점심 메뉴', dinner: '저녁 메뉴' },
  arabic:     { breakfast: 'قائمة الفطور', lunch: 'قائمة الغداء', dinner: 'قائمة العشاء' },
  russian:    { breakfast: 'Меню завтрака', lunch: 'Обеденное меню', dinner: 'Меню ужина' },
};

import { useState } from "react";

import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

ModuleRegistry.registerModules([AllCommunityModule]);

import { themeQuartz } from "ag-grid-community";
import { VENUES2 } from "./data/venues.tsx";

const myTheme = themeQuartz.withParams({
  accentColor: "#D78627",
  backgroundColor: "#1f2836",
  browserColorScheme: "dark",
  chromeBackgroundColor: {
    ref: "foregroundColor",
    mix: 0.07,
    onto: "backgroundColor",
  },
  fontFamily: {
    googleFont: "IBM Plex Mono",
  },
  foregroundColor: "#DF6868",
  headerFontSize: 14,
});

export type TagCategory = "OCCASION" | "MEAL_TYPE" | "CUISINE" | "VIBE";

interface Tag {
  id: number;
  name: string;
  category: TagCategory;
}

interface IRow {
  name: string;
  zone: { name: string; area: { name: string } };
  price: number;
  tags: Tag[];
}

export const Grid = () => {
  const [rowData] = useState<IRow[]>(VENUES2);

  console.log(VENUES2.length);

  const [colDefs] = useState<ColDef<IRow>[]>([
    { field: "name" },
    { field: "price" },
    { field: "zone.name" },
    { field: "zone.area.name" },
    {
      field: "tags",
      headerName: "Cuisine",
      valueFormatter: ({ value }) =>
        value
          .filter((v: Tag) => v.category === "CUISINE")
          .map((v: Tag) => v.name)
          .join(", "),
    },
  ]);

  const defaultColDef: ColDef = {
    flex: 1,
  };

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <AgGridReact
        rowData={rowData}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        theme={myTheme}
        loadThemeGoogleFonts={true}
      />
    </div>
  );
};

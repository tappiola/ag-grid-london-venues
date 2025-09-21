import { useMemo } from "react";

import {
  type ColDef,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type DoesFilterPassParams,
  CustomFilterModule,
  ClientSideRowModelModule,
  ValidationModule,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { VENUES2 } from "./data/venues.tsx";
import { SetFilter } from "./SetFilter.tsx";

ModuleRegistry.registerModules([AllCommunityModule]);

ModuleRegistry.registerModules([
  CustomFilterModule,
  ClientSideRowModelModule,
  ...(process.env.NODE_ENV !== "production" ? [ValidationModule] : []),
]);

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
  id: string;
  name: string;
  category: TagCategory;
}

interface IRow {
  name: string;
  zone?: { name?: string; area?: { name?: string } };
  price?: number;
  tags: Tag[];
}

const doesFilterPass = ({
  model,
  node,
  handlerParams,
}: DoesFilterPassParams<any, any, string[]>): boolean => {
  const value = handlerParams.getValue(node);
  if (!value) {
    return false;
  }

  return model.includes(value);
};

const doesFilterPass2 = ({
  model,
  node,
  handlerParams,
}: DoesFilterPassParams<any, any, string[]>): boolean => {
  const names = handlerParams.getValue(node);
  return names.some((n) => (model ?? []).includes(n));
};

export const Grid = () => {
  const rowData = useMemo<IRow[]>(() => VENUES2 as IRow[], []);

  const colDefs = useMemo<ColDef<IRow>[]>(
    () => [
      { field: "name" },
      { field: "price" },
      { field: "zone.name", headerName: "Zone" },
      {
        field: "zone.area.name",
        headerName: "Area",
        filter: {
          component: SetFilter,
          doesFilterPass,
        },
      },
      {
        field: "tags",
        headerName: "Cuisine",
        valueGetter: ({ data }) =>
          (data?.tags ?? [])
            .filter((t) => t.category === "CUISINE")
            .map((t) => t.name),
        filter: {
          component: SetFilter,
          doesFilterPass: doesFilterPass2,
          filterParams: {}, // can stay empty
        },
        valueFormatter: ({ value }) =>
          Array.isArray(value) ? value.join(", ") : "",
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<IRow>>(
    () => ({
      flex: 1,
      filter: true,
      resizable: true,
    }),
    [],
  );

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <AgGridReact
        rowData={rowData}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        theme={myTheme}
        loadThemeGoogleFonts={true}
        enableFilterHandlers={true}
      />
    </div>
  );
};

export default Grid;

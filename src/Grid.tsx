import { useMemo } from "react";

import {
  type ColDef,
  type DoesFilterPassParams,
  ModuleRegistry,
  AllCommunityModule,
  CustomFilterModule,
  ClientSideRowModelModule,
  themeQuartz,
  type ValueFormatterParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { VENUES2 } from "./data/venues.tsx";
import SetFilter from "./SetFilter.tsx";

ModuleRegistry.registerModules([
  AllCommunityModule,
  CustomFilterModule,
  ClientSideRowModelModule,
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

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const doesFilterPass = ({
  model,
  node,
  handlerParams,
}: DoesFilterPassParams<IRow, string | undefined, string[]>): boolean => {
  console.log({ model, node, handlerParams: handlerParams.getValue(node) });
  if (!model || model.length === 0) {
    return true;
  }

  const value = handlerParams.getValue(node);

  return model.includes(value.toString());
};

const doesArrayFilterPass = ({
  model,
  node,
  handlerParams,
}: DoesFilterPassParams<IRow, string[] | undefined, string[]>): boolean => {
  if (!model || model.length === 0) {
    return true;
  }

  const values = handlerParams.getValue(node);
  if (!isStringArray(values)) {
    return false;
  }

  return values.some((value) => model.includes(value));
};

const starFormatter = (p: ValueFormatterParams): string => {
  const raw = Number(p.value ?? 0);
  const n = Math.max(0, Math.min(5, Math.trunc(raw)));
  return "★".repeat(n);
};

export const Grid = () => {
  const rowData = useMemo<IRow[]>(() => VENUES2 as IRow[], []);

  const colDefs = useMemo<ColDef<IRow>[]>(
    () => [
      { field: "name" },
      {
        field: "price",
        valueFormatter: starFormatter,
        cellStyle: {
          fontSize: "24px",
        },
        filter: {
          component: SetFilter,
          doesFilterPass,
        },
      },
      {
        field: "zone.name",
        headerName: "Zone",
        filter: {
          component: SetFilter,
          doesFilterPass,
        },
      },
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
          doesFilterPass: doesArrayFilterPass,
        },
        valueFormatter: ({ value }) =>
          Array.isArray(value) ? value.join(", ") : "",
      },
      {
        field: "tags",
        headerName: "Occasion",
        valueGetter: ({ data }) =>
          (data?.tags ?? [])
            .filter((t) => t.category === "OCCASION")
            .map((t) => t.name),
        filter: {
          component: SetFilter,
          doesFilterPass: doesArrayFilterPass,
        },
        valueFormatter: ({ value }) =>
          Array.isArray(value) ? value.join(", ") : "",
      },
      {
        field: "tags",
        headerName: "Meal type",
        valueGetter: ({ data }) =>
          (data?.tags ?? [])
            .filter((t) => t.category === "MEAL_TYPE")
            .map((t) => t.name),
        filter: {
          component: SetFilter,
          doesFilterPass: doesArrayFilterPass,
        },
        valueFormatter: ({ value }) =>
          Array.isArray(value) ? value.join(", ") : "",
      },
      {
        field: "tags",
        headerName: "Vibe",
        valueGetter: ({ data }) =>
          (data?.tags ?? [])
            .filter((t) => t.category === "VIBE")
            .map((t) => t.name),
        filter: {
          component: SetFilter,
          doesFilterPass: doesArrayFilterPass,
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

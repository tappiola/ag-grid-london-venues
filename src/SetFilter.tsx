import type {
  FilterDisplay,
  FilterDisplayParams,
  IAfterGuiAttachedParams,
  RowNode,
  ValueGetterParams,
} from "ag-grid-community";

export class PersonFilter implements FilterDisplay<unknown, unknown, string[]> {
  gui!: HTMLDivElement;
  eFilterText!: HTMLInputElement;
  private listEl!: HTMLDivElement;
  private selectAllEl!: HTMLInputElement;

  private selected = new Set<string>();
  private detachModelUpdated?: () => void;

  init(params: FilterDisplayParams<unknown, unknown, string[]>) {
    this.gui = document.createElement("div");
    this.gui.innerHTML = `<div class="ag-filter-body-wrapper ag-simple-filter-body-wrapper ag-focus-managed">
      <div>
        <input type="text" id="filterText" placeholder="Search..." class="ag-input-field-input ag-text-field-input" />
      </div>

      <div style="margin:8px 0;">
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="selectAll" />
          <span>(Select All)</span>
        </label>
      </div>

      <div id="valuesList" style="max-height:280px;overflow:auto;"></div>
    </div>`;

    this.eFilterText = this.gui.querySelector(
      "#filterText",
    ) as HTMLInputElement;
    this.listEl = this.gui.querySelector("#valuesList") as HTMLDivElement;
    this.selectAllEl = this.gui.querySelector("#selectAll") as HTMLInputElement;

    const fp =
      (params.colDef as any)?.filter?.filterParams ??
      (params as any).filterParams ??
      {};
    const fixedValues: string[] | undefined = Array.isArray(fp.values)
      ? fp.values.map(String)
      : undefined;

    const readCell = (node: RowNode): unknown => {
      const colId = params.column.getColId();

      const apiWithGet = params.api as unknown as {
        getCellValue?: (p: { rowNode: RowNode; colKey: string }) => unknown;
      };
      if (typeof apiWithGet.getCellValue === "function") {
        return apiWithGet.getCellValue({ rowNode: node, colKey: colId });
      }

      const { colDef, columnApi, context, api } = params;
      if (colDef.valueGetter) {
        return (colDef.valueGetter as (p: ValueGetterParams) => unknown)({
          data: node.data,
          node,
          api,
          column: params.column,
          columnApi,
          colDef,
          context,
          getValue: (field: string) =>
            node.data ? (node.data as any)[field] : undefined,
        } as ValueGetterParams);
      }
      const field = colDef.field as string | undefined;
      if (!field) return undefined;
      return field
        .split(".")
        .reduce<any>((acc, k) => (acc == null ? acc : acc[k]), node.data);
    };

    // Universe of values (ALL rows, ignoring filters)
    const collectUniverse = (): string[] => {
      if (fixedValues) {
        return [...new Set(fixedValues)].sort((a, b) => a.localeCompare(b));
      }
      const set = new Set<string>();
      params.api.forEachNode((node: RowNode) => {
        if (!node.data) return;
        const raw = readCell(node);
        if (Array.isArray(raw)) for (const v of raw) set.add(String(v ?? ""));
        else set.add(String(raw ?? ""));
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    };

    // Available values under current filters/sort (for greying only)
    const collectAvailable = (): Set<string> => {
      const set = new Set<string>();
      params.api.forEachNodeAfterFilterAndSort((node: RowNode) => {
        if (!node.data) return;
        const raw = readCell(node);
        if (Array.isArray(raw)) for (const v of raw) set.add(String(v ?? ""));
        else set.add(String(raw ?? ""));
      });
      return set;
    };

    let values = collectUniverse();
    let availableSet = collectAvailable();

    // ✅ Default: Select All checked (no model emitted so column isn't "filtered")
    if (this.selected.size === 0 && values.length > 0) {
      this.selected = new Set(values);
    }

    const emit = () => {
      params.onModelChange(
        this.selected.size ? Array.from(this.selected) : null,
      );
    };

    const updateSelectAllState = () => {
      const total = values.length;
      const sel = this.selected.size;
      this.selectAllEl.checked = total > 0 && sel === total;
      this.selectAllEl.indeterminate = sel > 0 && sel < total;
    };

    const render = () => {
      const q = this.eFilterText.value.trim().toLowerCase();
      this.listEl.innerHTML = "";

      const filtered = values.filter((v) => v.toLowerCase().includes(q));

      for (const v of filtered) {
        const id = `pf_${params.column.getColId()}_${btoa(v).replace(/=+/g, "")}`;
        const isAvailable = availableSet.has(v);

        const label = document.createElement("label");
        label.htmlFor = id;
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.gap = "8px";
        label.style.marginBottom = "6px";
        if (!isAvailable) label.style.opacity = "0.6";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = id;
        cb.value = v;
        cb.checked = this.selected.has(v);
        cb.addEventListener("change", (e) => {
          console.log(this, params);
          console.log({ filtered, params: params.api.getDisplayedRowCount() });
          const input = e.currentTarget as HTMLInputElement;
          input.checked ? this.selected.add(v) : this.selected.delete(v);
          updateSelectAllState();
          emit();
        });

        const text = document.createElement("span");
        text.textContent = v;

        label.append(cb, text);
        this.listEl.appendChild(label);
      }

      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.style.opacity = "0.7";
        empty.style.fontStyle = "italic";
        empty.textContent = "No values";
        this.listEl.appendChild(empty);
      }

      updateSelectAllState();
    };

    // Search input filters the visible list only
    this.eFilterText.addEventListener("input", render);

    // Select All toggles the entire universe (not just visible)
    this.selectAllEl.addEventListener("change", () => {
      if (this.selectAllEl.checked) {
        this.selected = new Set(values);
      } else {
        this.selected.clear();
      }
      render(); // redraw checks
      emit();
    });

    // Keep availability up to date as filters/sort change elsewhere
    const onModelUpdated = () => {
      if (!fixedValues) values = collectUniverse();
      availableSet = collectAvailable();

      // ✅ If opening with no selection and data arrived now, default to Select All
      if (
        this.selected.size === 0 &&
        values.length > 0 &&
        (!params.model ||
          (Array.isArray(params.model) && params.model.length === 0))
      ) {
        this.selected = new Set(values);
      }

      // Drop selections that no longer exist in the universe
      this.selected.forEach((v) => {
        if (!values.includes(v)) this.selected.delete(v);
      });

      render();
    };
    params.api.addEventListener("modelUpdated", onModelUpdated);
    this.detachModelUpdated = () =>
      params.api.removeEventListener("modelUpdated", onModelUpdated);

    render();
  }

  refresh(
    _newParams: FilterDisplayParams<unknown, unknown, string[]>,
  ): boolean {
    return true;
  }

  getGui() {
    return this.gui;
  }

  afterGuiAttached(params?: IAfterGuiAttachedParams): void {
    if (!params?.suppressFocus) {
      this.eFilterText.focus();
    }
  }

  destroy(): void {
    this.detachModelUpdated?.();
  }
}

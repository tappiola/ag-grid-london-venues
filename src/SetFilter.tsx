import type {
  FilterDisplay,
  FilterDisplayParams,
  IAfterGuiAttachedParams,
  RowNode,
  ValueGetterParams,
} from "ag-grid-community";

export class SetFilter implements FilterDisplay<unknown, unknown, string[]> {
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
    // const collectAvailable = (): Set<string> => {
    //   const set = new Set<string>();
    //   params.api.forEachNodeAfterFilterAndSort((node: RowNode) => {
    //     if (!node.data) return;
    //     const raw = readCell(node);
    //     if (Array.isArray(raw)) for (const v of raw) set.add(String(v ?? ""));
    //     else set.add(String(raw ?? ""));
    //   });
    //   return set;
    // };

    const collectAvailable = (): string[] => {
      const set = new Set<string>();
      const colId = params.column.getColId();
      const model = params.api.getFilterModel();

      // 1. Start from universe (so you always have all possible values)
      const universe = collectUniverse();

      // 2. Collect values from rows after all filters
      params.api.forEachNodeAfterFilter((node: RowNode) => {
        if (!node.data) return;
        const raw = readCell(node);
        if (Array.isArray(raw)) {
          for (const v of raw) set.add(String(v ?? ""));
        } else {
          set.add(String(raw ?? ""));
        }
      });

      console.log({ set, model });

      // 3. If this column is currently filtering, ignore its effect:
      //    include full universe so options don't vanish
      if (model[colId]) {
        return [...universe].sort((a, b) => a.localeCompare(b));
      }

      return Array.from(set).sort((a, b) => a.localeCompare(b));
    };

    let values = collectAvailable();
    let availableSet = collectAvailable();

    // ✅ Always seed from model
    if (Array.isArray(params.model)) {
      this.selected = new Set(params.model.map(String));
    } else {
      this.selected = new Set(values); // default: all selected
    }

    const emit = () => {
      const total = values.length;
      const sel = this.selected.size;

      if (sel === total) {
        // all selected => no filter
        params.onModelChange(null);
      } else {
        // none or some => explicit list ([] = filter none)
        const ordered = values.filter((v) => this.selected.has(v));
        params.onModelChange(ordered);
      }
    };

    const updateSelectAllState = () => {
      const total = values.length;
      const sel = this.selected.size;
      this.selectAllEl.checked = total > 0 && sel === total;
      this.selectAllEl.indeterminate = sel > 0 && sel < total;
      console.log(this.selectAllEl.checked, this.selected.size);
    };

    const render = () => {
      const q = this.eFilterText.value.trim().toLowerCase();
      this.listEl.innerHTML = "";

      const filtered = availableSet.filter((v) => v.toLowerCase().includes(q));

      console.log({
        values,
        filtered,
        availableSet,
      });

      for (const v of filtered) {
        const id = `pf_${params.column.getColId()}_${btoa(v).replace(/=+/g, "")}`;
        const isAvailable = availableSet.includes(v);

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
          const input = e.currentTarget as HTMLInputElement;
          if (input.checked) {
            this.selected.add(v);
          } else {
            this.selected.delete(v);
          }
          emit();
          updateSelectAllState();
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

    this.selectAllEl.addEventListener("change", () => {
      if (this.selectAllEl.checked) {
        this.selected = new Set(values);
      } else {
        this.selected.clear();
      }
      render();
      emit();
    });

    const onModelUpdated = () => {
      if (!fixedValues) {
        values = collectAvailable();
      }
      availableSet = collectAvailable();

      const nextSelection = new Set<string>();
      this.selected.forEach((v) => {
        if (values.includes(v)) {
          nextSelection.add(v);
        }
      });

      this.selected = nextSelection;
      render();
    };

    params.api.addEventListener("modelUpdated", onModelUpdated);
    this.detachModelUpdated = () =>
      params.api.removeEventListener("modelUpdated", onModelUpdated);

    render();
  }

  refresh(): boolean {
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

export default SetFilter;

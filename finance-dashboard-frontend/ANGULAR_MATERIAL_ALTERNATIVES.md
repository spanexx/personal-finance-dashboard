# Angular Material Alternatives Guide

This guide provides comprehensive alternatives to replace Angular Material components in your finance dashboard.

## 🎯 Complete UI Framework Alternatives

### 1. **Ng-Zorro (Ant Design) - RECOMMENDED**

**Installation:**

```bash
ng add ng-zorro-antd
```

**Why Choose Ng-Zorro:**

- Better performance than Angular Material
- More comprehensive component library
- Better TypeScript support
- Enterprise-grade components
- Excellent documentation

### 2. **PrimeNG - Enterprise Grade**

**Installation:**

```bash
npm install primeng primeicons
```

**Why Choose PrimeNG:**

- 100+ UI components
- Professional themes
- Data table with advanced features
- Better accessibility
- Commercial support available

### 3. **Taiga UI - Modern & Lightweight**

**Installation:**

```bash
ng add @taiga-ui/cdk
```

**Why Choose Taiga UI:**

- Modern design system
- Tree-shakable
- Better bundle size
- TypeScript-first

## 🔄 Component Migration Guide

### Core Components Used in Your Budget Templates

#### **Data Tables**

**Current:** `mat-table`, `mat-header-cell`, `mat-cell`, `mat-row`

**Ng-Zorro Alternative:**

```html
<nz-table [nzData]="dataSource" [nzShowPagination]="true">
  <thead>
    <tr>
      <th nzSortFn="true">Template Name</th>
      <th>Type</th>
      <th>Categories</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr *ngFor="let template of dataSource">
      <td>{{ template.name }}</td>
      <td><nz-tag [nzColor]="template.type === 'predefined' ? 'blue' : 'green'">{{ template.type | titlecase }}</nz-tag></td>
      <td>{{ template.categories.length }} categories</td>
      <td>
        <nz-dropdown [nzTrigger]="'click'">
          <button nz-button nz-dropdown><i nz-icon nzType="more"></i></button>
          <ul nz-menu>
            <li nz-menu-item>Use Template</li>
            <li nz-menu-item>Edit</li>
            <li nz-menu-item>Delete</li>
          </ul>
        </nz-dropdown>
      </td>
    </tr>
  </tbody>
</nz-table>
```

**PrimeNG Alternative:**

```html
<p-table [value]="templates" [paginator]="true" [rows]="10">
  <ng-template pTemplate="header">
    <tr>
      <th pSortableColumn="name">Template Name</th>
      <th>Type</th>
      <th>Categories</th>
      <th>Actions</th>
    </tr>
  </ng-template>
  <ng-template pTemplate="body" let-template>
    <tr>
      <td>{{ template.name }}</td>
      <td><p-tag [value]="template.type"></p-tag></td>
      <td>{{ template.categories.length }} categories</td>
      <td>
        <p-menu #menu [model]="menuItems" [popup]="true"></p-menu>
        <p-button icon="pi pi-ellipsis-v" (click)="menu.toggle($event)"></p-button>
      </td>
    </tr>
  </ng-template>
</p-table>
```

#### **Form Controls**

**Current:** `mat-form-field`, `mat-input`, `mat-select`, `mat-option`

**Ng-Zorro Alternative:**

```html
<nz-form-item>
  <nz-form-label [nzRequired]="true">Template Name</nz-form-label>
  <nz-form-control>
    <input nz-input formControlName="name" placeholder="Enter template name">
  </nz-form-control>
</nz-form-item>

<nz-form-item>
  <nz-form-label>Category Type</nz-form-label>
  <nz-form-control>
    <nz-select formControlName="type" nzPlaceHolder="Select type">
      <nz-option nzValue="income" nzLabel="Income"></nz-option>
      <nz-option nzValue="expense" nzLabel="Expense"></nz-option>
    </nz-select>
  </nz-form-control>
</nz-form-item>
```

**PrimeNG Alternative:**

```html
<div class="p-field">
  <label for="templateName">Template Name *</label>
  <input id="templateName" type="text" pInputText formControlName="name" placeholder="Enter template name">
</div>

<div class="p-field">
  <label for="categoryType">Category Type</label>
  <p-dropdown id="categoryType" formControlName="type" [options]="typeOptions" placeholder="Select type"></p-dropdown>
</div>
```

#### **Buttons & Actions**

**Current:** `mat-button`, `mat-raised-button`, `mat-icon-button`

**Ng-Zorro Alternative:**

```html
<button nz-button nzType="primary">
  <i nz-icon nzType="plus"></i>
  Create Template
</button>

<button nz-button nzType="default">
  <i nz-icon nzType="upload"></i>
  Import Template
</button>

<button nz-button nzType="text" nzShape="circle">
  <i nz-icon nzType="more"></i>
</button>
```

**PrimeNG Alternative:**

```html
<p-button label="Create Template" icon="pi pi-plus" styleClass="p-button-primary"></p-button>
<p-button label="Import Template" icon="pi pi-upload" styleClass="p-button-outlined"></p-button>
<p-button icon="pi pi-ellipsis-v" styleClass="p-button-text p-button-rounded"></p-button>
```

#### **Chips & Tags**

**Current:** `mat-chip`

**Ng-Zorro Alternative:**

```html
<nz-tag [nzColor]="template.type === 'predefined' ? 'blue' : 'green'">
  {{ template.type | titlecase }}
</nz-tag>
```

**PrimeNG Alternative:**

```html
<p-tag [value]="template.type | titlecase" 
       [severity]="template.type === 'predefined' ? 'info' : 'success'">
</p-tag>
```

#### **Dialogs & Modals**

**Current:** `mat-dialog`, `mat-dialog-content`, `mat-dialog-actions`

**Ng-Zorro Alternative:**

```html
<nz-modal [(nzVisible)]="isVisible" nzTitle="Create Template" (nzOnCancel)="handleCancel()" (nzOnOk)="handleOk()">
  <ng-container *nzModalContent>
    <!-- Form content here -->
  </ng-container>
  <div *nzModalFooter>
    <button nz-button nzType="default" (click)="handleCancel()">Cancel</button>
    <button nz-button nzType="primary" (click)="handleOk()">Create</button>
  </div>
</nz-modal>
```

**PrimeNG Alternative:**

```html
<p-dialog header="Create Template" [(visible)]="displayDialog" [modal]="true" [style]="{width: '50vw'}">
  <!-- Form content here -->
  <ng-template pTemplate="footer">
    <p-button label="Cancel" icon="pi pi-times" (onClick)="cancel()"></p-button>
    <p-button label="Create" icon="pi pi-check" (onClick)="save()"></p-button>
  </ng-template>
</p-dialog>
```

#### **Toggles & Switches**

**Current:** `mat-slide-toggle`, `mat-checkbox`

**Ng-Zorro Alternative:**

```html
<nz-switch [(ngModel)]="template.isActive" 
           [nzDisabled]="template.type === 'predefined'">
</nz-switch>

<label nz-checkbox [(ngModel)]="isActive">Active template</label>
```

**PrimeNG Alternative:**

```html
<p-inputSwitch [(ngModel)]="template.isActive" 
               [disabled]="template.type === 'predefined'">
</p-inputSwitch>

<p-checkbox [(ngModel)]="isActive" label="Active template"></p-checkbox>
```

#### **Menus & Dropdowns**

**Current:** `mat-menu`, `mat-menu-item`

**Ng-Zorro Alternative:**

```html
<nz-dropdown [nzTrigger]="'click'">
  <button nz-button nz-dropdown>
    <i nz-icon nzType="more"></i>
  </button>
  <ul nz-menu>
    <li nz-menu-item>
      <i nz-icon nzType="play-circle"></i>
      Use Template
    </li>
    <li nz-menu-item>
      <i nz-icon nzType="edit"></i>
      Edit
    </li>
    <li nz-menu-divider></li>
    <li nz-menu-item>
      <i nz-icon nzType="delete"></i>
      Delete
    </li>
  </ul>
</nz-dropdown>
```

#### **Progress & Loading**

**Current:** `mat-spinner`, `mat-progress-bar`

**Ng-Zorro Alternative:**

```html
<nz-spin [nzSpinning]="loading">
  <!-- Content here -->
</nz-spin>

<nz-progress [nzPercent]="75"></nz-progress>
```

**PrimeNG Alternative:**

```html
<p-progressSpinner [style]="{width: '50px', height: '50px'}" *ngIf="loading"></p-progressSpinner>
<p-progressBar [value]="75"></p-progressBar>
```

## 🎨 Styling & Theming

### Ng-Zorro Theming

```scss
// styles.scss
@import "~ng-zorro-antd/ng-zorro-antd.min.css";

// Custom theme
:root {
  --ant-primary-color: #667eea;
  --ant-success-color: #52c41a;
  --ant-warning-color: #faad14;
  --ant-error-color: #f5222d;
}
```

### PrimeNG Theming

```scss
// styles.scss
@import "~primeicons/primeicons.css";
@import "~primeng/resources/themes/saga-blue/theme.css";
@import "~primeng/resources/primeng.min.css";

// Custom theme variables
:root {
  --primary-color: #667eea;
  --primary-color-text: #ffffff;
  --surface-0: #ffffff;
  --surface-50: #fafafa;
}
```

## 🚀 Migration Steps

### 1. Choose Your Alternative

Based on your needs:

- **Ng-Zorro**: Best overall replacement, similar API to Material
- **PrimeNG**: Enterprise features, better data components
- **Taiga UI**: Modern, lightweight, TypeScript-first

### 2. Install Dependencies

```bash
# For Ng-Zorro
ng add ng-zorro-antd

# For PrimeNG
npm install primeng primeicons
npm install @angular/animations  # if not already installed

# For Taiga UI
ng add @taiga-ui/cdk
```

### 3. Update Module Imports

Replace Angular Material imports with your chosen alternative.

### 4. Component-by-Component Migration

Start with the most used components:

1. Forms (`mat-form-field` → `nz-form-item` or `p-field`)
2. Tables (`mat-table` → `nz-table` or `p-table`)
3. Buttons (`mat-button` → `nz-button` or `p-button`)
4. Dialogs (`mat-dialog` → `nz-modal` or `p-dialog`)

### 5. Update Styling

- Remove Material-specific CSS classes
- Update color variables
- Adjust spacing and typography

## 📦 VS Code Extensions for Development

```vscode-extensions
cipchk.ng-zorro-vscode,yigitfindikli.primengsnippets
```

## 🔧 Utility Libraries

### For Custom Components

If you want to build custom components:

1. **Headless UI Libraries:**
   - `@angular/cdk` (Keep the CDK, remove Material components)
   - `@ngneat/helipopper` for tooltips/popovers
   - `@ngneat/overview` for overlays

2. **Styling Solutions:**
   - **Tailwind CSS** for utility-first styling
   - **Bootstrap 5** for traditional framework
   - **CSS-in-JS** with styled-components

### Tailwind CSS Integration

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

```html
<!-- Replace mat-button with Tailwind -->
<button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
  Create Template
</button>

<!-- Replace mat-card -->
<div class="bg-white shadow-lg rounded-lg p-6">
  <!-- Content -->
</div>
```

## 🎯 Recommendation for Your Finance Dashboard

## **Best Choice: Ng-Zorro (Ant Design)**

**Reasons:**

1. **Similar API** to Angular Material - easier migration
2. **Better Performance** - smaller bundle size
3. **More Components** - especially for data visualization
4. **Enterprise Ready** - perfect for finance applications
5. **Excellent TypeScript Support**
6. **Active Community** and regular updates

**Migration Priority:**

1. Start with `budget-templates.component.html` (your most complex component)
2. Replace `mat-table` with `nz-table`
3. Replace form components (`mat-form-field` → `nz-form-item`)
4. Replace buttons and actions
5. Update dialogs and modals

Would you like me to create a detailed migration plan for your specific components or help you implement the Ng-Zorro alternative?

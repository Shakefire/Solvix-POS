import React, { useState } from 'react';
import { Product } from '@/lib/pharmacy';

interface CategoryManagerProps {
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  refreshCategories?: () => Promise<void>;
}

const normalizeCategoryName = (value: string) => (value || '').trim();
const dedupeCategories = (values: Array<string | undefined | null>) => {
  const seen = new Set<string>();
  return values.reduce<string[]>((acc, value) => {
    const normalized = normalizeCategoryName(value ?? '');
    if (!normalized) return acc;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push(normalized);
    return acc;
  }, []);
};

export default function CategoryManager({ categories, setCategories, products, setProducts, refreshCategories }: CategoryManagerProps) {
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const addCategory = async () => {
    const trimmed = normalizeCategoryName(name);
    if (!trimmed) return;
    if (categories.some((categoryItem) => categoryItem.toLowerCase() === trimmed.toLowerCase())) {
      alert('Category already exists.');
      return;
    }
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    let saved = false;
    if (electronApi?.saveCategory) {
      try {
        await electronApi.saveCategory({ name: trimmed });
        saved = true;
        if (refreshCategories) await refreshCategories();
      } catch (error) {
        console.error('Failed to save category:', error);
      }
    }
    if (!saved) setCategories((prev) => dedupeCategories([...prev, trimmed]));
    setName('');
  };

  const filteredCategories = dedupeCategories(categories).filter((categoryItem) =>
    categoryItem.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const saveEditedCategory = async () => {
    if (!editingCategory) return;
    const trimmed = normalizeCategoryName(editName);
    if (!trimmed) {
      alert('Category name is required.');
      return;
    }
    if (trimmed.toLowerCase() === editingCategory.toLowerCase()) {
      setEditingCategory(null);
      setEditName('');
      return;
    }
    if (categories.some((categoryItem) => categoryItem.toLowerCase() === trimmed.toLowerCase())) {
      alert('Category already exists.');
      return;
    }
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    let saved = false;
    if (electronApi?.saveCategory) {
      try {
        const cats = await electronApi.getCategories();
        const catToEdit = cats?.find((c: any) => c.name === editingCategory);
        if (catToEdit) await electronApi.saveCategory({ id: catToEdit.id, name: trimmed });
        else await electronApi.saveCategory({ name: trimmed });
        saved = true;
        setProducts((prev) =>
          prev.map((product) =>
            product.category === editingCategory ? { ...product, category: trimmed } : product
          )
        );
        if (refreshCategories) await refreshCategories();
      } catch (error) {
        console.error('Failed to save category:', error);
      }
    }
    if (!saved) {
      setCategories((prev) => dedupeCategories(prev.map((category) => (category === editingCategory ? trimmed : category))));
      setProducts((prev) =>
        prev.map((product) =>
          product.category === editingCategory ? { ...product, category: trimmed } : product
        )
      );
    }
    setEditingCategory(null);
    setEditName('');
  };

  const deleteCategory = async (categoryToDelete: string) => {
    const usedCount = products.filter((product) => product.category === categoryToDelete).length;
    if (usedCount > 0) {
      alert(`Cannot delete category '${categoryToDelete}'. ${usedCount} product(s) are still assigned to it.`);
      return;
    }
    if (!confirm(`Delete category ${categoryToDelete}?`)) return;
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    let deleted = false;
    if (electronApi?.deleteCategory) {
      try {
        const cats = await electronApi.getCategories();
        const catToDelete = cats?.find((c: any) => c.name === categoryToDelete);
        if (catToDelete) await electronApi.deleteCategory(catToDelete.id);
        deleted = true;
        if (refreshCategories) await refreshCategories();
      } catch (error) {
        console.error('Failed to delete category:', error);
      }
    }
    if (!deleted) setCategories((prev) => dedupeCategories(prev.filter((category) => category !== categoryToDelete)));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        <div className="relative">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            
            onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); e.currentTarget.blur(); } }}
            placeholder="Search categories..."
            className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 pr-9 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1.8fr_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            
            onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setName(''); e.currentTarget.blur(); } }}
            placeholder="Type category name, press Enter to add"
            className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text"
          />
          <button onClick={addCategory} className="rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition">
            Add
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {filteredCategories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500 text-center">
            No categories match your search.
          </div>
        ) : (
          filteredCategories.map((categoryItem) => {
            const usedCount = products.filter((product) => product.category === categoryItem).length;
            const disabled = usedCount > 0;
            const isEditing = editingCategory === categoryItem;
            return (
              <div key={categoryItem} className="flex flex-col gap-3 rounded-3xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                {isEditing ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 w-full">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditedCategory(); if (e.key === 'Escape') { setEditingCategory(null); setEditName(''); } }}
                      className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text"
                    />
                    <button onClick={saveEditedCategory} className="rounded-3xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition">
                      Save
                    </button>
                    <button onClick={() => { setEditingCategory(null); setEditName(''); }} className="rounded-3xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-900">{categoryItem}</span>
                    {disabled && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        {usedCount} in use
                      </span>
                    )}
                  </div>
                )}
                {!isEditing && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingCategory(categoryItem);
                        setEditName(categoryItem);
                      }}
                      className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCategory(categoryItem)}
                      disabled={disabled}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${disabled ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

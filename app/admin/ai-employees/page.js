"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const permissionLabels = {
  products: "المنتجات",
  marketing: "التسويق",
  design: "التصميم",
  video: "الفيديو",
  analytics: "التحليلات",
  moderation: "المراجعة",
  publishing: "النشر",
};

const permissionKeys = Object.keys(permissionLabels);

const levelLabels = {
  junior: "مبتدئ",
  mid: "متوسط",
  senior: "خبير",
  lead: "قائد",
};

const statusLabels = {
  active: "نشط",
  inactive: "غير نشط",
  suspended: "موقوف",
};

const emptyForm = {
  name: "",
  specialization: "",
  description: "",
  department_id: "",
  admin_id: "",
  personality: "",
  tone: "",
  level: "junior",
  status: "active",
  avatar_url: "",
  instructions: "",
  permissions: {
    products: false,
    marketing: false,
    design: false,
    video: false,
    analytics: false,
    moderation: false,
    publishing: false,
  },
};

export default function AIEmployeesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [selectedId, setSelectedId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [activeTab, setActiveTab] = useState("overview");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        window.location.href = "/dashboard";
        return;
      }

      const [employeesRes, departmentsRes, adminsRes, profilesRes] =
        await Promise.all([
          supabase
            .from("ai_employees")
            .select("*")
            .order("created_at", { ascending: false }),

          supabase
            .from("departments")
            .select("*")
            .order("name", { ascending: true }),

          supabase
            .from("admins")
            .select("*")
            .order("full_name", { ascending: true }),

          supabase
            .from("profiles")
            .select("id,full_name,role,account_status")
            .order("full_name", { ascending: true }),
        ]);

      if (employeesRes.error) throw employeesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (adminsRes.error) throw adminsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const employeeRows = employeesRes.data || [];

      setEmployees(employeeRows);
      setDepartments(departmentsRes.data || []);
      setAdmins(adminsRes.data || []);
      setProfiles(profilesRes.data || []);

      if (employeeRows.length && !selectedId) {
        setSelectedId(employeeRows[0].id);
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر تحميل موظفي AI");
    } finally {
      setLoading(false);
    }
  }

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesStatus =
        statusFilter === "all" || employee.status === statusFilter;

      if (!term) return matchesStatus;

      const department = departments.find(
        (item) => item.id === employee.department_id
      );

      const admin = admins.find((item) => item.id === employee.admin_id);

      const haystack = [
        employee.name,
        employee.specialization,
        employee.description,
        employee.personality,
        employee.tone,
        department?.name,
        admin?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && haystack.includes(term);
    });
  }, [employees, departments, admins, search, statusFilter]);

  useEffect(() => {
    if (!filteredEmployees.length) {
      setSelectedId(null);
      return;
    }

    const exists = filteredEmployees.some((item) => item.id === selectedId);

    if (!exists) {
      setSelectedId(filteredEmployees[0].id);
    }
  }, [filteredEmployees, selectedId]);

  const selectedEmployee =
    employees.find((item) => item.id === selectedId) || null;

  const stats = useMemo(() => {
    const active = employees.filter((x) => x.status === "active").length;
    const inactive = employees.filter((x) => x.status === "inactive").length;
    const suspended = employees.filter((x) => x.status === "suspended").length;

    const tasks = employees.reduce(
      (sum, x) => sum + Number(x.tasks_completed || 0),
      0
    );

    const cost = employees.reduce(
      (sum, x) => sum + Number(x.total_cost || 0),
      0
    );

    return {
      total: employees.length,
      active,
      inactive,
      suspended,
      tasks,
      cost,
    };
  }, [employees]);

  function getDepartment(id) {
    return departments.find((item) => item.id === id);
  }

  function getAdmin(id) {
    return admins.find((item) => item.id === id);
  }

  function getAdminProfile(admin) {
    if (!admin?.user_id) return null;

    return profiles.find((profile) => profile.id === admin.user_id);
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      permissions: { ...emptyForm.permissions },
    });
    setMessage("");
    setError("");
    setDrawerOpen(true);
  }

  function openEdit(employee) {
    setEditingId(employee.id);

    setForm({
      name: employee.name || "",
      specialization: employee.specialization || "",
      description: employee.description || "",
      department_id: employee.department_id || "",
      admin_id: employee.admin_id || "",
      personality: employee.personality || "",
      tone: employee.tone || "",
      level: employee.level || "junior",
      status: employee.status || "active",
      avatar_url: employee.avatar_url || "",
      instructions: employee.instructions || "",
      permissions: {
        ...emptyForm.permissions,
        ...(employee.permissions || {}),
      },
    });

    setMessage("");
    setError("");
    setDrawerOpen(true);
  }

  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function togglePermission(key) {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: !current.permissions[key],
      },
    }));
  }

  async function saveEmployee(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("اكتب اسم موظف AI.");
      return;
    }

    if (!form.specialization.trim()) {
      setError("اكتب تخصص موظف AI.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const payload = {
        name: form.name.trim(),
        specialization: form.specialization.trim(),
        description: form.description.trim() || null,
        department_id: form.department_id || null,
        admin_id: form.admin_id || null,
        personality: form.personality.trim() || null,
        tone: form.tone.trim() || null,
        level: form.level,
        status: form.status,
        avatar_url: form.avatar_url.trim() || null,
        instructions: form.instructions.trim() || null,
        permissions: form.permissions,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from("ai_employees")
          .update(payload)
          .eq("id", editingId)
          .select("*")
          .single();

        if (updateError) throw updateError;

        setEmployees((current) =>
          current.map((item) => (item.id === editingId ? data : item))
        );

        setSelectedId(editingId);
        setMessage("تم تحديث موظف AI.");
      } else {
        const { data, error: insertError } = await supabase
          .from("ai_employees")
          .insert({
            ...payload,
            created_by: user.id,
          })
          .select("*")
          .single();

        if (insertError) throw insertError;

        setEmployees((current) => [data, ...current]);
        setSelectedId(data.id);
        setMessage("تم إنشاء موظف AI.");
      }

      setDrawerOpen(false);
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر حفظ الموظف.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEmployeeStatus(employee) {
    const nextStatus =
      employee.status === "active" ? "inactive" : "active";

    setError("");

    try {
      const { data, error: updateError } = await supabase
        .from("ai_employees")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employee.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      setEmployees((current) =>
        current.map((item) => (item.id === employee.id ? data : item))
      );

      setMessage(
        nextStatus === "active"
          ? "تم تشغيل الموظف."
          : "تم إيقاف الموظف."
      );
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر تغيير حالة الموظف.");
    }
  }

  async function suspendEmployee(employee) {
    setError("");

    try {
      const { data, error: updateError } = await supabase
        .from("ai_employees")
        .update({
          status: "suspended",
          updated_at: new Date().toISOString(),
        })
        .eq("id", employee.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      setEmployees((current) =>
        current.map((item) => (item.id === employee.id ? data : item))
      );

      setMessage("تم إيقاف الموظف مؤقتاً.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر إيقاف الموظف.");
    }
  }

  function closeDrawer() {
    if (saving) return;
    setDrawerOpen(false);
    setError("");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ar-AE").format(Number(value || 0));
  }

  function formatCost(value) {
    return `$ ${Number(value || 0).toFixed(4)}`;
  }

  function statusClass(status) {
    if (status === "active") return "status active";
    if (status === "suspended") return "status suspended";
    return "status inactive";
  }

  function permissionCount(employee) {
    return permissionKeys.filter(
      (key) => employee?.permissions?.[key]
    ).length;
  }

  return (
    <main dir="rtl" className="page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f5f7f6;
          color: #172019;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Tahoma,
            Arial,
            sans-serif;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }
      `}</style>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(64, 157, 88, 0.07),
              transparent 28%
            ),
            #f5f7f6;
        }

        .shell {
          max-width: 1500px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .breadcrumb {
          color: #8b948e;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .titleRow {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .titleIcon {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: #e7f5eb;
          color: #32874b;
          font-weight: 800;
          font-size: 17px;
        }

        h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 42px);
          letter-spacing: -1.5px;
        }

        .subtitle {
          margin: 7px 0 0;
          color: #77817b;
          font-size: 15px;
        }

        .primaryButton {
          border: 0;
          border-radius: 15px;
          padding: 14px 20px;
          background: #3d9652;
          color: white;
          font-weight: 800;
          box-shadow: 0 8px 20px rgba(61, 150, 82, 0.18);
        }

        .primaryButton:hover {
          background: #328447;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .stat {
          background: white;
          border: 1px solid #e2e7e4;
          border-radius: 18px;
          padding: 17px 18px;
        }

        .statLabel {
          color: #8a938d;
          font-size: 13px;
          margin-bottom: 7px;
        }

        .statValue {
          font-size: 25px;
          font-weight: 850;
        }

        .statValue.green {
          color: #32904b;
        }

        .workspace {
          display: grid;
          grid-template-columns: 390px minmax(0, 1fr);
          min-height: 670px;
          background: white;
          border: 1px solid #e0e6e2;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 15px 50px rgba(25, 44, 32, 0.05);
        }

        .listPanel {
          border-left: 1px solid #e5e9e7;
          background: #fbfcfb;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .listHeader {
          padding: 20px;
          border-bottom: 1px solid #e8ecea;
        }

        .listHeaderTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .listTitle {
          font-size: 18px;
          font-weight: 850;
        }

        .countPill {
          min-width: 30px;
          height: 30px;
          padding: 0 9px;
          border-radius: 99px;
          background: #eaf5ed;
          color: #33884b;
          display: grid;
          place-items: center;
          font-weight: 800;
        }

        .search {
          width: 100%;
          border: 1px solid #dce3df;
          background: white;
          border-radius: 13px;
          padding: 12px 14px;
          outline: none;
          color: #172019;
          margin-bottom: 9px;
        }

        .search:focus {
          border-color: #65a977;
          box-shadow: 0 0 0 3px rgba(65, 151, 83, 0.08);
        }

        .select {
          width: 100%;
          border: 1px solid #dce3df;
          background: white;
          border-radius: 13px;
          padding: 12px 14px;
          outline: none;
        }

        .employeeList {
          overflow: auto;
          padding: 12px;
          flex: 1;
        }

        .employeeItem {
          width: 100%;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 16px;
          padding: 14px;
          text-align: right;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 7px;
        }

        .employeeItem:hover {
          background: #f2f7f3;
        }

        .employeeItem.selected {
          background: #eaf6ed;
          border-color: #cce7d3;
        }

        .avatar {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          flex: 0 0 46px;
          display: grid;
          place-items: center;
          background: #e6f4e9;
          color: #31884a;
          font-weight: 900;
        }

        .employeeText {
          min-width: 0;
          flex: 1;
        }

        .employeeName {
          font-weight: 850;
          font-size: 16px;
          margin-bottom: 3px;
        }

        .employeeSpecialization {
          color: #818a84;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .employeeStatusDot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #39a45a;
        }

        .employeeStatusDot.off {
          background: #adb5b0;
        }

        .emptyList {
          padding: 40px 20px;
          text-align: center;
          color: #8b938e;
        }

        .detailPanel {
          min-width: 0;
          padding: 28px;
          background: white;
        }

        .detailTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e8ecea;
        }

        .profileHeader {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .bigAvatar {
          width: 76px;
          height: 76px;
          border-radius: 22px;
          background: #e6f4e9;
          color: #31884a;
          display: grid;
          place-items: center;
          font-size: 24px;
          font-weight: 900;
          flex: 0 0 76px;
        }

        .profileName {
          font-size: 30px;
          font-weight: 900;
          letter-spacing: -1px;
          margin-bottom: 4px;
        }

        .profileRole {
          color: #6e7972;
          font-size: 15px;
          margin-bottom: 10px;
        }

        .metaRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .meta {
          padding: 7px 10px;
          border-radius: 9px;
          background: #f1f4f2;
          color: #68736c;
          font-size: 12px;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 11px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 800;
        }

        .status::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
        }

        .status.active {
          background: #eaf7ed;
          color: #318b4b;
        }

        .status.inactive {
          background: #f0f2f1;
          color: #7b8580;
        }

        .status.suspended {
          background: #fff2e7;
          color: #b46d2d;
        }

        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .secondaryButton {
          border: 1px solid #dce3df;
          background: white;
          color: #344038;
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 750;
        }

        .secondaryButton:hover {
          background: #f5f8f6;
        }

        .dangerButton {
          border: 1px solid #efd9d2;
          background: #fff8f6;
          color: #a55342;
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 750;
        }

        .tabs {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding: 14px 0;
          border-bottom: 1px solid #e8ecea;
        }

        .tab {
          border: 0;
          background: transparent;
          color: #78827c;
          padding: 9px 13px;
          border-radius: 10px;
          white-space: nowrap;
          font-weight: 750;
        }

        .tab.active {
          background: #eaf6ed;
          color: #31884a;
        }

        .content {
          padding-top: 22px;
        }

        .overviewGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .metric {
          border: 1px solid #e5eae7;
          border-radius: 15px;
          padding: 16px;
        }

        .metricLabel {
          color: #8a938d;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 22px;
          font-weight: 900;
        }

        .section {
          border: 1px solid #e5eae7;
          border-radius: 17px;
          padding: 18px;
          margin-bottom: 14px;
        }

        .sectionTitle {
          font-size: 15px;
          font-weight: 850;
          margin-bottom: 14px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .infoBox {
          background: #f8faf9;
          border-radius: 12px;
          padding: 13px;
        }

        .infoLabel {
          font-size: 11px;
          color: #8a938d;
          margin-bottom: 5px;
        }

        .infoValue {
          font-size: 14px;
          font-weight: 750;
        }

        .permissions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .permission {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 13px;
          border: 1px solid #e5eae7;
          border-radius: 11px;
        }

        .permission.on {
          background: #f0f8f2;
          border-color: #d3ead8;
        }

        .permissionState {
          font-size: 11px;
          font-weight: 800;
        }

        .permission.on .permissionState {
          color: #31894a;
        }

        .permission.off .permissionState {
          color: #a1aaa5;
        }

        .instructions {
          white-space: pre-wrap;
          line-height: 1.9;
          color: #536058;
          font-size: 14px;
          background: #f8faf9;
          padding: 15px;
          border-radius: 12px;
        }

        .drawerOverlay {
          position: fixed;
          inset: 0;
          background: rgba(18, 28, 22, 0.28);
          z-index: 50;
        }

        .drawer {
          position: absolute;
          top: 0;
          bottom: 0;
          right: 0;
          width: min(620px, 100%);
          background: white;
          box-shadow: -20px 0 50px rgba(0, 0, 0, 0.13);
          display: flex;
          flex-direction: column;
        }

        .drawerHeader {
          padding: 20px 22px;
          border-bottom: 1px solid #e5eae7;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .drawerTitle {
          font-size: 20px;
          font-weight: 900;
        }

        .closeButton {
          width: 38px;
          height: 38px;
          border: 1px solid #e0e5e2;
          background: white;
          border-radius: 10px;
          font-size: 20px;
        }

        .form {
          overflow: auto;
          padding: 22px;
          flex: 1;
        }

        .formSection {
          margin-bottom: 24px;
        }

        .formSectionTitle {
          font-size: 14px;
          font-weight: 900;
          margin-bottom: 12px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          color: #6f7973;
          font-size: 12px;
          font-weight: 700;
        }

        .field input,
        .field textarea,
        .field select {
          width: 100%;
          border: 1px solid #dce3df;
          background: white;
          border-radius: 11px;
          padding: 11px 12px;
          outline: none;
        }

        .field textarea {
          resize: vertical;
          min-height: 90px;
        }

        .field input:focus,
        .field textarea:focus,
        .field select:focus {
          border-color: #61a875;
          box-shadow: 0 0 0 3px rgba(61, 150, 82, 0.08);
        }

        .permissionChecks {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .check {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          border: 1px solid #e1e6e3;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
        }

        .check input {
          accent-color: #3d9652;
        }

        .drawerFooter {
          padding: 16px 22px;
          border-top: 1px solid #e5eae7;
          display: flex;
          gap: 9px;
        }

        .drawerFooter button {
          flex: 1;
        }

        .notice {
          margin-bottom: 14px;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 13px;
        }

        .notice.success {
          background: #eaf7ed;
          color: #287641;
        }

        .notice.error {
          background: #fff1ee;
          color: #a24d3b;
        }

        .loading {
          min-height: 500px;
          display: grid;
          place-items: center;
          color: #7b857f;
        }

        .emptyDetail {
          height: 100%;
          min-height: 500px;
          display: grid;
          place-items: center;
          text-align: center;
          color: #818b85;
        }

        .emptyDetail strong {
          display: block;
          color: #263229;
          font-size: 20px;
          margin-bottom: 7px;
        }

        @media (max-width: 1000px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .workspace {
            grid-template-columns: 330px minmax(0, 1fr);
          }

          .overviewGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 12px;
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .primaryButton {
            width: 100%;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .workspace {
            display: block;
            border-radius: 18px;
          }

          .listPanel {
            border-left: 0;
            border-bottom: 1px solid #e5e9e7;
            max-height: 390px;
          }

          .detailPanel {
            padding: 18px;
          }

          .detailTop {
            flex-direction: column;
          }

          .actions {
            width: 100%;
          }

          .actions button {
            flex: 1;
          }

          .profileName {
            font-size: 26px;
          }

          .infoGrid,
          .permissions,
          .formGrid,
          .permissionChecks {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .overviewGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 450px) {
          .stats {
            grid-template-columns: 1fr 1fr;
          }

          .stat {
            padding: 14px;
          }

          .statValue {
            font-size: 21px;
          }

          .profileHeader {
            align-items: flex-start;
          }

          .bigAvatar {
            width: 60px;
            height: 60px;
            flex-basis: 60px;
          }
        }
      `}</style>

      <div className="shell">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              الإدارة الداخلية / موظفو AI
            </div>

            <div className="titleRow">
              <div className="titleIcon">AI</div>

              <div>
                <h1>موظفو الذكاء الاصطناعي</h1>
                <p className="subtitle">
                  إدارة موظفي AI وربطهم بالأقسام والـ Admins والصلاحيات.
                </p>
              </div>
            </div>
          </div>

          <button className="primaryButton" onClick={openCreate}>
            + موظف AI جديد
          </button>
        </header>

        {message && (
          <div className="notice success">{message}</div>
        )}

        {error && !drawerOpen && (
          <div className="notice error">{error}</div>
        )}

        <section className="stats">
          <div className="stat">
            <div className="statLabel">إجمالي الموظفين</div>
            <div className="statValue">
              {formatNumber(stats.total)}
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">نشط</div>
            <div className="statValue green">
              {formatNumber(stats.active)}
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">غير نشط</div>
            <div className="statValue">
              {formatNumber(stats.inactive)}
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">موقوف</div>
            <div className="statValue">
              {formatNumber(stats.suspended)}
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">المهام المكتملة</div>
            <div className="statValue">
              {formatNumber(stats.tasks)}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="workspace">
            <div className="loading">جاري تحميل موظفي AI...</div>
          </div>
        ) : (
          <section className="workspace">
            <aside className="listPanel">
              <div className="listHeader">
                <div className="listHeaderTop">
                  <div className="listTitle">فريق AI</div>
                  <div className="countPill">
                    {filteredEmployees.length}
                  </div>
                </div>

                <input
                  className="search"
                  placeholder="ابحث عن موظف..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  className="select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">كل الحالات</option>
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                  <option value="suspended">موقوف</option>
                </select>
              </div>

              <div className="employeeList">
                {filteredEmployees.length === 0 ? (
                  <div className="emptyList">
                    لا يوجد موظفون مطابقون للبحث.
                  </div>
                ) : (
                  filteredEmployees.map((employee) => (
                    <button
                      key={employee.id}
                      className={`employeeItem ${
                        selectedId === employee.id ? "selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedId(employee.id);
                        setActiveTab("overview");
                      }}
                    >
                      <div className="avatar">
                        {employee.avatar_url ? (
                          <img
                            src={employee.avatar_url}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              borderRadius: "inherit",
                            }}
                          />
                        ) : (
                          "AI"
                        )}
                      </div>

                      <div className="employeeText">
                        <div className="employeeName">
                          {employee.name}
                        </div>

                        <div className="employeeSpecialization">
                          {employee.specialization ||
                            "بدون تخصص محدد"}
                        </div>
                      </div>

                      <span
                        className={`employeeStatusDot ${
                          employee.status !== "active" ? "off" : ""
                        }`}
                      />
                    </button>
                  ))
                )}
              </div>
            </aside>

            <div className="detailPanel">
              {!selectedEmployee ? (
                <div className="emptyDetail">
                  <div>
                    <strong>اختر موظف AI</strong>
                    <div>
                      اختر موظفاً من القائمة لعرض ملفه وإدارته.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="detailTop">
                    <div className="profileHeader">
                      <div className="bigAvatar">
                        {selectedEmployee.avatar_url ? (
                          <img
                            src={selectedEmployee.avatar_url}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              borderRadius: "inherit",
                            }}
                          />
                        ) : (
                          "AI"
                        )}
                      </div>

                      <div>
                        <div className="profileName">
                          {selectedEmployee.name}
                        </div>

                        <div className="profileRole">
                          {selectedEmployee.specialization ||
                            "موظف ذكاء اصطناعي"}
                        </div>

                        <div className="metaRow">
                          <span
                            className={statusClass(
                              selectedEmployee.status
                            )}
                          >
                            {statusLabels[selectedEmployee.status] ||
                              selectedEmployee.status}
                          </span>

                          <span className="meta">
                            {levelLabels[selectedEmployee.level] ||
                              selectedEmployee.level}
                          </span>

                          <span className="meta">
                            {permissionCount(selectedEmployee)} صلاحيات
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="actions">
                      <button
                        className="secondaryButton"
                        onClick={() => openEdit(selectedEmployee)}
                      >
                        تعديل الموظف
                      </button>

                      {selectedEmployee.status === "active" ? (
                        <button
                          className="secondaryButton"
                          onClick={() =>
                            toggleEmployeeStatus(selectedEmployee)
                          }
                        >
                          إيقاف
                        </button>
                      ) : (
                        <button
                          className="secondaryButton"
                          onClick={() =>
                            toggleEmployeeStatus(selectedEmployee)
                          }
                        >
                          تشغيل
                        </button>
                      )}

                      {selectedEmployee.status !== "suspended" && (
                        <button
                          className="dangerButton"
                          onClick={() =>
                            suspendEmployee(selectedEmployee)
                          }
                        >
                          إيقاف مؤقت
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="tabs">
                    <button
                      className={`tab ${
                        activeTab === "overview" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("overview")}
                    >
                      نظرة عامة
                    </button>

                    <button
                      className={`tab ${
                        activeTab === "performance" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("performance")}
                    >
                      الأداء
                    </button>

                    <button
                      className={`tab ${
                        activeTab === "permissions" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("permissions")}
                    >
                      الصلاحيات
                    </button>

                    <button
                      className={`tab ${
                        activeTab === "instructions" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("instructions")}
                    >
                      التعليمات
                    </button>
                  </div>

                  <div className="content">
                    {activeTab === "overview" && (
                      <>
                        <div className="overviewGrid">
                          <div className="metric">
                            <div className="metricLabel">
                              المهام المكتملة
                            </div>
                            <div className="metricValue">
                              {formatNumber(
                                selectedEmployee.tasks_completed
                              )}
                            </div>
                          </div>

                          <div className="metric">
                            <div className="metricLabel">
                              المهام الفاشلة
                            </div>
                            <div className="metricValue">
                              {formatNumber(
                                selectedEmployee.tasks_failed
                              )}
                            </div>
                          </div>

                          <div className="metric">
                            <div className="metricLabel">
                              نسبة النجاح
                            </div>
                            <div className="metricValue">
                              {Number(
                                selectedEmployee.success_rate || 0
                              ).toFixed(1)}
                              %
                            </div>
                          </div>

                          <div className="metric">
                            <div className="metricLabel">
                              التكلفة
                            </div>
                            <div className="metricValue">
                              {formatCost(
                                selectedEmployee.total_cost
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="section">
                          <div className="sectionTitle">
                            الهيكل الإداري
                          </div>

                          <div className="infoGrid">
                            <div className="infoBox">
                              <div className="infoLabel">
                                القسم
                              </div>
                              <div className="infoValue">
                                {getDepartment(
                                  selectedEmployee.department_id
                                )?.name || "بدون قسم"}
                              </div>
                            </div>

                            <div className="infoBox">
                              <div className="infoLabel">
                                الـ Admin المسؤول
                              </div>
                              <div className="infoValue">
                                {getAdmin(
                                  selectedEmployee.admin_id
                                )?.full_name || "بدون Admin"}
                              </div>
                            </div>

                            <div className="infoBox">
                              <div className="infoLabel">
                                التخصص
                              </div>
                              <div className="infoValue">
                                {selectedEmployee.specialization ||
                                  "غير محدد"}
                              </div>
                            </div>

                            <div className="infoBox">
                              <div className="infoLabel">
                                المستوى
                              </div>
                              <div className="infoValue">
                                {levelLabels[
                                  selectedEmployee.level
                                ] || selectedEmployee.level}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="section">
                          <div className="sectionTitle">
                            وصف الموظف
                          </div>

                          <div style={{ color: "#657069", lineHeight: 1.9 }}>
                            {selectedEmployee.description ||
                              "لم تتم إضافة وصف لهذا الموظف حتى الآن."}
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === "performance" && (
                      <>
                        <div className="overviewGrid">
                          <div className="metric">
                            <div className="metricLabel">
                              نسبة النجاح
                            </div>
                            <div className="metricValue">
                              {Number(
                                selectedEmployee.success_rate || 0
                              ).toFixed(1)}
                              %
                            </div>
                          </div>

                          <div className="metric">
                            <div className="metricLabel">
                              التقييم
                            </div>
                            <div className="metricValue">
                              {Number(
                                selectedEmployee.average_rating || 0
                              ).toFixed(1)}
                              /5
                            </div>
                          </div>

                          <div className="metric">
                            <div className="metricLabel">
                              سرعة التنفيذ
                            </div>
                            <div className="metricValue">
                              {Number(
                                selectedEmployee.average_speed_seconds ||
                                  0
                              ).toFixed(0)}
                              ث
                            </div>
                          </div>

                          <div className="metric">
                            <div className="metricLabel">
                              التكلفة
                            </div>
                            <div className="metricValue">
                              {formatCost(
                                selectedEmployee.total_cost
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="section">
                          <div className="sectionTitle">
                            ملخص الأداء
                          </div>

                          <div className="infoGrid">
                            <div className="infoBox">
                              <div className="infoLabel">
                                المهام المكتملة
                              </div>
                              <div className="infoValue">
                                {formatNumber(
                                  selectedEmployee.tasks_completed
                                )}
                              </div>
                            </div>

                            <div className="infoBox">
                              <div className="infoLabel">
                                المهام الفاشلة
                              </div>
                              <div className="infoValue">
                                {formatNumber(
                                  selectedEmployee.tasks_failed
                                )}
                              </div>
                            </div>

                            <div className="infoBox">
                              <div className="infoLabel">
                                آخر نشاط
                              </div>
                              <div className="infoValue">
                                {selectedEmployee.last_active_at
                                  ? new Date(
                                      selectedEmployee.last_active_at
                                    ).toLocaleString("ar-AE")
                                  : "لا يوجد"}
                              </div>
                            </div>

                            <div className="infoBox">
                              <div className="infoLabel">
                                التكلفة الإجمالية
                              </div>
                              <div className="infoValue">
                                {formatCost(
                                  selectedEmployee.total_cost
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === "permissions" && (
                      <div className="section">
                        <div className="sectionTitle">
                          صلاحيات موظف AI
                        </div>

                        <div className="permissions">
                          {permissionKeys.map((key) => {
                            const enabled =
                              !!selectedEmployee.permissions?.[key];

                            return (
                              <div
                                key={key}
                                className={`permission ${
                                  enabled ? "on" : "off"
                                }`}
                              >
                                <span>
                                  {permissionLabels[key]}
                                </span>

                                <span className="permissionState">
                                  {enabled ? "مسموح" : "غير مسموح"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeTab === "instructions" && (
                      <>
                        <div className="section">
                          <div className="sectionTitle">
                            الشخصية
                          </div>

                          <div className="infoGrid">
                            <div className="infoBox">
                              <div className="infoLabel">
                                الشخصية
                              </div>
                              <div className="infoValue">
                                {selectedEmployee.personality ||
                                  "غير محددة"}
                              </div>
                            </div>

                            <div className="infoBox">
                              <div className="infoLabel">
                                أسلوب التواصل
                              </div>
                              <div className="infoValue">
                                {selectedEmployee.tone ||
                                  "غير محدد"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="section">
                          <div className="sectionTitle">
                            تعليمات التشغيل
                          </div>

                          <div className="instructions">
                            {selectedEmployee.instructions ||
                              "لم تتم إضافة تعليمات تشغيل لهذا الموظف."}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      {drawerOpen && (
        <div
          className="drawerOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDrawer();
            }
          }}
        >
          <aside className="drawer">
            <div className="drawerHeader">
              <div className="drawerTitle">
                {editingId
                  ? "تعديل موظف AI"
                  : "إضافة موظف AI جديد"}
              </div>

              <button
                className="closeButton"
                onClick={closeDrawer}
                type="button"
              >
                ×
              </button>
            </div>

            <form className="form" onSubmit={saveEmployee}>
              {error && (
                <div className="notice error">{error}</div>
              )}

              <div className="formSection">
                <div className="formSectionTitle">
                  البيانات الأساسية
                </div>

                <div className="formGrid">
                  <div className="field">
                    <label>اسم الموظف</label>
                    <input
                      value={form.name}
                      onChange={(e) =>
                        updateForm("name", e.target.value)
                      }
                      placeholder="مثال: والم"
                    />
                  </div>

                  <div className="field">
                    <label>التخصص</label>
                    <input
                      value={form.specialization}
                      onChange={(e) =>
                        updateForm(
                          "specialization",
                          e.target.value
                        )
                      }
                      placeholder="مثال: مساعد إدارة وتشغيل سوق AI"
                    />
                  </div>

                  <div className="field full">
                    <label>الوصف</label>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        updateForm("description", e.target.value)
                      }
                      placeholder="ما وظيفة هذا الموظف؟"
                    />
                  </div>

                  <div className="field">
                    <label>المستوى</label>
                    <select
                      value={form.level}
                      onChange={(e) =>
                        updateForm("level", e.target.value)
                      }
                    >
                      <option value="junior">مبتدئ</option>
                      <option value="mid">متوسط</option>
                      <option value="senior">خبير</option>
                      <option value="lead">قائد</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>الحالة</label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        updateForm("status", e.target.value)
                      }
                    >
                      <option value="active">نشط</option>
                      <option value="inactive">غير نشط</option>
                      <option value="suspended">موقوف</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="formSection">
                <div className="formSectionTitle">
                  الهيكل الإداري
                </div>

                <div className="formGrid">
                  <div className="field">
                    <label>القسم</label>
                    <select
                      value={form.department_id}
                      onChange={(e) =>
                        updateForm(
                          "department_id",
                          e.target.value
                        )
                      }
                    >
                      <option value="">بدون قسم</option>

                      {departments.map((department) => (
                        <option
                          key={department.id}
                          value={department.id}
                        >
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>الـ Admin المسؤول</label>
                    <select
                      value={form.admin_id}
                      onChange={(e) =>
                        updateForm("admin_id", e.target.value)
                      }
                    >
                      <option value="">بدون Admin</option>

                      {admins.map((admin) => {
                        const profile = getAdminProfile(admin);

                        return (
                          <option key={admin.id} value={admin.id}>
                            {admin.full_name}
                            {profile?.full_name &&
                            profile.full_name !== admin.full_name
                              ? ` — ${profile.full_name}`
                              : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              <div className="formSection">
                <div className="formSectionTitle">
                  الشخصية وطريقة التواصل
                </div>

                <div className="formGrid">
                  <div className="field">
                    <label>الشخصية</label>
                    <input
                      value={form.personality}
                      onChange={(e) =>
                        updateForm(
                          "personality",
                          e.target.value
                        )
                      }
                      placeholder="عملي، دقيق، سريع..."
                    />
                  </div>

                  <div className="field">
                    <label>أسلوب التواصل</label>
                    <input
                      value={form.tone}
                      onChange={(e) =>
                        updateForm("tone", e.target.value)
                      }
                      placeholder="إماراتي، واضح، مختصر..."
                    />
                  </div>

                  <div className="field full">
                    <label>رابط الصورة</label>
                    <input
                      value={form.avatar_url}
                      onChange={(e) =>
                        updateForm(
                          "avatar_url",
                          e.target.value
                        )
                      }
                      placeholder="اختياري"
                    />
                  </div>
                </div>
              </div>

              <div className="formSection">
                <div className="formSectionTitle">
                  الصلاحيات
                </div>

                <div className="permissionChecks">
                  {permissionKeys.map((key) => (
                    <label className="check" key={key}>
                      <input
                        type="checkbox"
                        checked={!!form.permissions[key]}
                        onChange={() => togglePermission(key)}
                      />

                      <span>{permissionLabels[key]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="formSection">
                <div className="formSectionTitle">
                  تعليمات التشغيل
                </div>

                <div className="field">
                  <textarea
                    style={{ minHeight: 150 }}
                    value={form.instructions}
                    onChange={(e) =>
                      updateForm(
                        "instructions",
                        e.target.value
                      )
                    }
                    placeholder="اكتب هنا التعليمات التي تحدد كيف يعمل الموظف وما الذي يجب عليه فعله وما الذي يمنع عليه فعله."
                  />
                </div>
              </div>
            </form>

            <div className="drawerFooter">
              <button
                type="button"
                className="secondaryButton"
                onClick={closeDrawer}
                disabled={saving}
              >
                إلغاء
              </button>

              <button
                type="button"
                className="primaryButton"
                onClick={saveEmployee}
                disabled={saving}
              >
                {saving
                  ? "جاري الحفظ..."
                  : editingId
                  ? "حفظ التعديلات"
                  : "إنشاء الموظف"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

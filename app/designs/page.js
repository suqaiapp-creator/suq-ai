async function createDesign() {
  setError("");
  setMessage("");

  if (!selectedProduct) {
    setError("اختر المنتج أولاً.");
    return;
  }

  if (selectedProductLocked) {
    setError(
      "هذا المنتج مقفل ولا يمكن استخدامه في التسويق أو التصميم حالياً."
    );
    return;
  }

  if (!selectedProduct.image_url) {
    setError("المنتج لا يحتوي على صورة. أضف صورة المنتج أولاً.");
    return;
  }

  if (selectedProductUnclear && !responsibilityAccepted) {
    const accepted = await checkResponsibilityAcceptance();

    if (!accepted) {
      setError(
        "هذا المنتج يحتاج تأكيد مسؤولية المنتج قبل إنشاء التصميم."
      );
      return;
    }

    setResponsibilityAccepted(true);
  }

  setSaving(true);

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      router.replace("/login");
      return;
    }

    const response = await fetch("/api/generate-design", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        productId: selectedProduct.id,
        mode,
        template:
          mode === "simple"
            ? selectedTemplate
            : null,
        style:
          mode === "professional"
            ? selectedStyle
            : null,
        background:
          mode === "professional"
            ? BACKGROUNDS.find(
                (item) => item.id === selectedBackground
              )?.value || selectedBackground
            : null,
        format: selectedFormat,
        description: description.trim(),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      if (result?.requiresResponsibility) {
        setResponsibilityAccepted(false);
        setError(
          "يجب تأكيد مسؤولية المنتج قبل إنشاء التصميم."
        );
      } else {
        setError(
          result?.error ||
            "تعذر تجهيز طلب التصميم."
        );
      }

      return;
    }

    setMessage(
      "تم تجهيز طلب التصميم بنجاح. التصميم بانتظار مرحلة التوليد."
    );

    await loadPage();
  } catch (err) {
    console.error(err);
    setError(
      "حدث خطأ أثناء إرسال طلب التصميم."
    );
  } finally {
    setSaving(false);
  }
}

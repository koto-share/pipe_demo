// scripts.js

// モデルビューアの参照
const viewer = document.getElementById('viewer');

// ページロード時にプレビュー画像の natural サイズを記録
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.preview-item').forEach(item => {
    const baseImg = item.querySelector('img:not(.overlay)');
    const basePath = baseImg.getAttribute('data-base') || baseImg.src;
    const p = new Image();
    p.onload = () => {
      baseImg.dataset.naturalWidth = p.naturalWidth;
      baseImg.dataset.naturalHeight = p.naturalHeight;
      const overlay = item.querySelector('.overlay');
      if (overlay) {
        overlay.dataset.naturalWidth = p.naturalWidth;
        overlay.dataset.naturalHeight = p.naturalHeight;
      }
      adjustPreviewScale();
    };
    p.src = basePath;
  });
  window.addEventListener('resize', adjustPreviewScale);
});

/// テクスチャ差し替え処理
async function changeTexture(materialName, input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const url = URL.createObjectURL(file);

  // ★★ 変更ボタンの色変更 ★★
  // input は <input type="file"> なので、親要素の <label class="replace-btn"> がボタン本体
  const replaceBtn = input.parentElement;
  replaceBtn.style.backgroundColor = "#ff0000ff"; // 好きな色に変更
  replaceBtn.style.color = "#fff";              // 文字色（必要なら）
  // ★★ ここまで追加 ★★

  try {
    // モデルビューア側のマテリアル差し替え
    const material = viewer.model && viewer.model.materials &&
      viewer.model.materials.find(m => m.name === materialName);
    if (material) {
      const texture = await viewer.createTexture(url);
      material.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
    }

    // プレビュー側の差し替え
    const preview = document.getElementById(`preview-${materialName}`);
    if (preview) {
      preview.src = url;
      adjustPreviewScale();
    }
  } catch (err) {
    console.error('テクスチャ差し替え失敗:', err);
  }
}



// プレビューをレスポンシブにスケールさせる
function adjustPreviewScale() {
  document.querySelectorAll('.pattern').forEach(pattern => {
    const scaleContainer = pattern.querySelector('.preview-scale');
    const wrapper = pattern.querySelector('.preview-wrapper');
    const items = Array.from(pattern.querySelectorAll('.preview-item'));

    let totalNaturalWidth = 0;
    let naturalHeight = 0;
    items.forEach(it => {
      const img = it.querySelector('img:not(.overlay)');
      const w = parseInt(img.dataset.naturalWidth || img.naturalWidth || 100, 10);
      const h = parseInt(img.dataset.naturalHeight || img.naturalHeight || 100, 10);
      totalNaturalWidth += w;
      naturalHeight = Math.max(naturalHeight, h);
      img.style.width = w + 'px';
      img.style.height = h + 'px';
      const overlay = it.querySelector('.overlay');
      if (overlay) {
        overlay.style.width = w + 'px';
        overlay.style.height = h + 'px';
      }
    });

    const availWidth = Math.max(10, scaleContainer.clientWidth - 2);
    let scale = 1;
    if (totalNaturalWidth > 0 && totalNaturalWidth > availWidth) {
      scale = availWidth / totalNaturalWidth;
    }
    wrapper.style.transform = `scale(${scale})`;
    scaleContainer.style.height = Math.ceil(naturalHeight * scale + 70) + 'px';
  });
}

// PDF 出力
document.getElementById('print-btn').addEventListener('click', async () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [297, 210] }); // A4

  const patterns = Array.from(document.querySelectorAll('.pattern'));
  const checked = patterns.filter(p => p.querySelector('.print-check').checked);

  const LEFT_MARGIN_MM = 7;
  const IMG_HEIGHT_MM = 36;
  const BLANK_HEIGHT_MM = 51;
  const PAGE_TOP_MARGIN = 20;
  const PAGE_PATTERN_LIMIT = 2;

  let y = PAGE_TOP_MARGIN;
  let printedCount = 0;

  for (let i = 0; i < checked.length; i++) {
    const pattern = checked[i];
    const items = Array.from(pattern.querySelectorAll('.preview-item'));

    const composedList = await Promise.all(items.map(item => {
      const baseImgEl = item.querySelector('img:not(.overlay)');
      const overlayEl = item.querySelector('.overlay');
      const baseOriginal = baseImgEl.getAttribute('data-base') || baseImgEl.src;
      const displayedSrc = baseImgEl.src;
      const overlaySrc = overlayEl ? overlayEl.src : null;
      return composeImagesRespectBase(baseOriginal, displayedSrc, overlaySrc);
    }));

    let totalWidthMM = 0;
    const scaled = composedList.map(ci => {
      const ratio = ci.width / ci.height;
      const widthMM = IMG_HEIGHT_MM * ratio;
      totalWidthMM += widthMM;
      return { dataUrl: ci.dataUrl, widthMM };
    });

    let x = LEFT_MARGIN_MM;
    for (const s of scaled) {
      try {
        pdf.addImage(s.dataUrl, 'PNG', x, y, s.widthMM, IMG_HEIGHT_MM);
      } catch (e) {
        console.error('addImage 失敗:', e);
      }
      x += s.widthMM;
    }

    pdf.setDrawColor(150);
    pdf.setLineWidth(0.25);
    pdf.rect(LEFT_MARGIN_MM, y, totalWidthMM, IMG_HEIGHT_MM + BLANK_HEIGHT_MM);

    y += IMG_HEIGHT_MM + BLANK_HEIGHT_MM + 20;
    printedCount++;
    if (printedCount % PAGE_PATTERN_LIMIT === 0 && i < checked.length - 1) {
      pdf.addPage();
      y = PAGE_TOP_MARGIN;
    }
  }

  try { pdf.save('patterns.pdf'); } catch (e) { console.error('PDF 保存に失敗:', e); }
});

// 画像合成（ベース・差し替え後・オーバーレイをまとめる）
function composeImagesRespectBase(baseOriginalSrc, displayedSrc, overlaySrc) {
  return new Promise(resolve => {
    const baseRef = new Image();
    const displayed = new Image();
    const overlay = new Image();

    baseRef.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = baseRef.naturalWidth || 100;
      canvas.height = baseRef.naturalHeight || 100;
      const ctx = canvas.getContext('2d');

      displayed.onload = () => {
        try { ctx.drawImage(displayed, 0, 0, canvas.width, canvas.height); }
        catch (e) { ctx.drawImage(baseRef, 0, 0, canvas.width, canvas.height); }

        if (overlaySrc) {
          overlay.onload = () => {
            try { ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height); } catch (e) {}
            resolve({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
          };
          overlay.onerror = () => resolve({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
          overlay.src = overlaySrc;
        } else {
          resolve({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
        }
      };

      displayed.onerror = () => {
        try { ctx.drawImage(baseRef, 0, 0, canvas.width, canvas.height); } catch (e) {}
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
      };

      displayed.src = displayedSrc;
    };

    baseRef.onerror = () => {
      resolve({ dataUrl: '', width: 100, height: 100 });
    };

    baseRef.src = baseOriginalSrc;
  });
}

function resetTexture(materialName) {
  const preview = document.getElementById(`preview-${materialName}`);
  const baseSrc = preview.getAttribute('data-base');

  // プレビュー画像をデフォルトへ戻す
  preview.src = baseSrc;

  // モデルビューア側も元に戻す
  const material = viewer.model && viewer.model.materials &&
    viewer.model.materials.find(m => m.name === materialName);

  if (material) {
    viewer.createTexture(baseSrc).then(texture => {
      material.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
    });
  }

  // 変更ボタンの色を元に戻す
  const item = preview.closest('.preview-item');
  const replaceBtn = item.querySelector('.replace-btn');
  replaceBtn.style.backgroundColor = "#ff4d4d"; // デフォルトの赤
  replaceBtn.style.color = "#fff";
}



// scripts.js

const viewer = document.getElementById('viewer');

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


// テクスチャ差し替え
async function changeTexture(materialName, input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const url = URL.createObjectURL(file);

  const replaceBtn = input.parentElement;
  replaceBtn.style.backgroundColor = "#ff0000";
  replaceBtn.style.color = "#fff";

  try {
    const material = viewer.model?.materials?.find(m => m.name === materialName);
    if (material) {
      const texture = await viewer.createTexture(url);
      material.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
    }

    const preview = document.getElementById(`preview-${materialName}`);
    if (preview) {
      preview.src = url;
      adjustPreviewScale();
    }
  } catch (err) {
    console.error(err);
  }
}


// ★★★ 高さを揃えるための修正版スケール処理 ★★★
function adjustPreviewScale() {
  document.querySelectorAll('.pattern').forEach(pattern => {
    const scaleContainer = pattern.querySelector('.preview-scale');
    const wrapper = pattern.querySelector('.preview-wrapper');
    const items = Array.from(pattern.querySelectorAll('.preview-item'));

    let totalWidth = 0;

    items.forEach(it => {
      const img = it.querySelector('img:not(.overlay)');
      const naturalW = Number(img.dataset.naturalWidth || 100);
      const naturalH = Number(img.dataset.naturalHeight || 100);

      // CSS の高さを基準に横幅だけ計算
      const cssHeight = img.clientHeight || 220;
      const ratio = naturalW / naturalH;
      const displayWidth = cssHeight * ratio;

      img.style.width = displayWidth + 'px';
      // ❌ height は JS で触らない（CSS に任せる）

      const overlay = it.querySelector('.overlay');
      if (overlay) {
        overlay.style.width = displayWidth + 'px';
        overlay.style.height = cssHeight + 'px';
      }

      totalWidth += displayWidth;
    });

    const availWidth = scaleContainer.clientWidth;
    let scale = 1;

    if (totalWidth > availWidth) {
      scale = availWidth / totalWidth;
    }

    wrapper.style.transform = `scale(${scale})`;
    scaleContainer.style.height = Math.ceil(
      items[0].querySelector('img').clientHeight * scale + 80
    ) + 'px';
  });
}


// ===== PDF 出力（変更なし） =====
document.getElementById('print-btn').addEventListener('click', async () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [182, 257] });

  const patterns = Array.from(document.querySelectorAll('.pattern'))
    .filter(p => p.querySelector('.print-check').checked);

  const IMG_HEIGHT_MM = 36;
  let y = 20;

  for (const pattern of patterns) {
    const items = Array.from(pattern.querySelectorAll('.preview-item'));

    let x = 7;
    for (const item of items) {
      const img = item.querySelector('img:not(.overlay)');
      const overlay = item.querySelector('.overlay');

      const composed = await composeImagesRespectBase(
        img.getAttribute('data-base'),
        img.src,
        overlay?.src
      );

      const ratio = composed.width / composed.height;
      const w = IMG_HEIGHT_MM * ratio;

      pdf.addImage(composed.dataUrl, 'PNG', x, y, w, IMG_HEIGHT_MM);
      x += w;
    }

    y += 90;
  }

  pdf.save('patterns.pdf');
});


// ===== 画像合成（元のまま） =====
function composeImagesRespectBase(baseOriginalSrc, displayedSrc, overlaySrc) {
  return new Promise(resolve => {
    const baseRef = new Image();
    const displayed = new Image();
    const overlay = new Image();

    baseRef.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = baseRef.naturalWidth;
      canvas.height = baseRef.naturalHeight;
      const ctx = canvas.getContext('2d');

      displayed.onload = () => {
        ctx.drawImage(displayed, 0, 0, canvas.width, canvas.height);
        if (overlaySrc) {
          overlay.onload = () => {
            ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
            resolve({ dataUrl: canvas.toDataURL(), width: canvas.width, height: canvas.height });
          };
          overlay.src = overlaySrc;
        } else {
          resolve({ dataUrl: canvas.toDataURL(), width: canvas.width, height: canvas.height });
        }
      };
      displayed.src = displayedSrc;
    };
    baseRef.src = baseOriginalSrc;
  });
}

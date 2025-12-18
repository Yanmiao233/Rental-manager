// ===== Supabase 初始化 =====
const SUPABASE_URL = 'https://nfdscwxidxzczinqdgfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZHNjd3hpZHh6Y3ppbnFkZ2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNDcwMDQsImV4cCI6MjA4MTYyMzAwNH0.qvIceRf-EpWZyOm2ZiUaVq9nV22rOtvsgNcmt2eCtyM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM 元素
const rentalsList = document.getElementById('rentals-list');
const formContainer = document.getElementById('form-container');
const addBtn = document.getElementById('add-btn');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');

// 表单字段
const recordIdInput = document.getElementById('record-id');
const urlInput = document.getElementById('url');
const titleInput = document.getElementById('title');
const featuresInput = document.getElementById('features');
const areaInput = document.getElementById('area');
const parkingInput = document.getElementById('parking');
const monthlyRentInput = document.getElementById('monthly_rent');
const propertyFeeInput = document.getElementById('property_fee');
const thumbnailInput = document.getElementById('thumbnail');
const thumbnailPreview = document.getElementById('thumbnail-preview');

let currentThumbnailUrl = '';

// ===== 工具函数 =====
function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '无效链接';
  }
}

function calculateTotalPrice(rental) {
  const rent = rental.monthly_rent || 0;
  const fee = rental.property_fee || 0;
  return (rent + fee).toLocaleString() + ' 元';
}

function formatParking(parking) {
  return parking ? '有' : '无';
}

// ===== 渲染列表 =====
async function renderRentals() {
  const { data, error } = await supabase
    .from('rentals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    alert('加载失败: ' + error.message);
    return;
  }

  rentalsList.innerHTML = '';
  data.forEach(rental => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="edit-delete">
        <button class="edit-btn" data-id="${rental.id}">编辑</button>
        <button class="delete-btn" data-id="${rental.id}">×</button>
      </div>
      <h3>${rental.title || getDomainFromUrl(rental.url)}</h3>
      <p>网址: <a href="${rental.url}" target="_blank">${rental.url}</a></p>
      ${rental.features ? `<p>特点: ${rental.features}</p>` : ''}
      <p>面积: ${rental.area || '?'} 平</p>
      <p>车位: ${formatParking(rental.parking)}</p>
      <p>月租: ${rental.monthly_rent} 元</p>
      ${rental.property_fee ? `<p>物业费: ${rental.property_fee} 元</p>` : ''}
      <p>总计: ${calculateTotalPrice(rental)}</p>
      ${rental.thumbnail_url ? `<img src="${rental.thumbnail_url}" style="max-width:100px;">` : ''}
    `;
    rentalsList.appendChild(card);
  });

  // 绑定事件
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editRental(btn.dataset.id));
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteRental(btn.dataset.id));
  });
}

// ===== 上传图片到 Supabase Storage =====
async function uploadThumbnail(file) {
  if (!file) return null;
  const fileName = `${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('thumbnails')
    .upload(`public/${fileName}`, file, { upsert: false });

  if (error) throw error;
  const { data: publicUrl } = supabase.storage
    .from('thumbnails')
    .getPublicUrl(`public/${fileName}`);
  return publicUrl.publicUrl;
}

// ===== 保存表单 =====
async function saveRental() {
  const id = recordIdInput.value;
  const url = urlInput.value.trim();
  const title = titleInput.value.trim() || null;
  const features = featuresInput.value.trim() || null;
  const area = areaInput.value ? parseInt(areaInput.value) : null;
  const parking = parkingInput.value === 'true' ? true : parkingInput.value === 'false' ? false : null;
  const monthly_rent = parseInt(monthlyRentInput.value);
  const property_fee = propertyFeeInput.value ? parseInt(propertyFeeInput.value) : null;

  let thumbnail_url = currentThumbnailUrl;
  if (thumbnailInput.files[0]) {
    try {
      thumbnail_url = await uploadThumbnail(thumbnailInput.files[0]);
    } catch (err) {
      alert('图片上传失败: ' + err.message);
      return;
    }
  }

  const record = {
    url, title, features, area, parking, monthly_rent, property_fee, thumbnail_url
  };

  let error;
  if (id) {
    ({ error } = await supabase.from('rentals').update(record).eq('id', id));
  } else {
    ({ error } = await supabase.from('rentals').insert([record]));
  }

  if (error) {
    alert('保存失败: ' + error.message);
    return;
  }

  hideForm();
  renderRentals();
}

// ===== 编辑/新增 =====
function showForm(isEdit = false, rental = null) {
  formContainer.style.display = 'block';
  document.getElementById('form-title').textContent = isEdit ? '编辑租房信息' : '添加租房信息';

  if (isEdit && rental) {
    recordIdInput.value = rental.id;
    urlInput.value = rental.url;
    titleInput.value = rental.title || '';
    featuresInput.value = rental.features || '';
    areaInput.value = rental.area || '';
    parkingInput.value = rental.parking === true ? 'true' : rental.parking === false ? 'false' : '';
    monthlyRentInput.value = rental.monthly_rent;
    propertyFeeInput.value = rental.property_fee || '';
    currentThumbnailUrl = rental.thumbnail_url || '';
    thumbnailPreview.innerHTML = rental.thumbnail_url ? `<img src="${rental.thumbnail_url}" style="max-width:100px;">` : '';
  } else {
    recordIdInput.value = '';
    urlInput.value = titleInput.value = featuresInput.value = areaInput.value = '';
    parkingInput.value = '';
    monthlyRentInput.value = propertyFeeInput.value = '';
    thumbnailInput.value = '';
    thumbnailPreview.innerHTML = '';
    currentThumbnailUrl = '';
  }
}

function hideForm() {
  formContainer.style.display = 'none';
}

// ===== 删除 =====
async function deleteRental(id) {
  if (!confirm('确定删除？')) return;
  const { error } = await supabase.from('rentals').delete().eq('id', id);
  if (error) {
    alert('删除失败: ' + error.message);
  } else {
    renderRentals();
  }
}

// ===== 导出/导入 =====
exportBtn.addEventListener('click', async () => {
  const { data } = await supabase.from('rentals').select('*');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rentals-export.json';
  a.click();
});

importBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    const text = await file.text();
    const data = JSON.parse(text);
    // 批量插入（注意：会覆盖现有数据？谨慎！）
    const { error } = await supabase.from('rentals').insert(data);
    if (error) alert('导入失败: ' + error.message);
    else renderRentals();
  };
  input.click();
});

// ===== 事件绑定 =====
addBtn.addEventListener('click', () => showForm());
cancelBtn.addEventListener('click', hideForm);
saveBtn.addEventListener('click', saveRental);

// 初始化
renderRentals();
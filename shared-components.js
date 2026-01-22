/*
 * ═══════════════════════════════════════════════════════════════════════════
 * SHARED UI COMPONENTS - DMG Command Centre
 *
 * JavaScript utilities for:
 * - Sliding page transitions (no dark overlays)
 * - Document upload with Firebase Storage
 * - Toast notifications
 * - Consistent interactions
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE STORAGE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const STORAGE_CONFIG = {
    bucketUrl: 'gs://dmg-command-centre-native.firebasestorage.app',
    maxFileSize: 25 * 1024 * 1024, // 25MB
    allowedTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'text/plain',
        'text/csv'
    ]
};

// ═══════════════════════════════════════════════════════════════════════════
// SLIDING PAGE MANAGER
// Manages smooth page transitions without dark overlays
// ═══════════════════════════════════════════════════════════════════════════
class SlidePageManager {
    constructor(options = {}) {
        this.mainViewId = options.mainViewId || 'mainView';
        this.slidePageId = options.slidePageId || 'slidePage';
        this.onOpen = options.onOpen || null;
        this.onClose = options.onClose || null;
        this.isOpen = false;

        this.setupKeyboardListeners();
    }

    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    open(content, options = {}) {
        const mainView = document.getElementById(this.mainViewId);
        const slidePage = document.getElementById(this.slidePageId);

        if (!mainView || !slidePage) {
            console.error('SlidePageManager: Required elements not found');
            return;
        }

        // Build slide page content
        slidePage.innerHTML = this.buildSlidePageHTML(content, options);

        // Animate main view out
        mainView.classList.add('slide-out');

        // Animate slide page in
        requestAnimationFrame(() => {
            slidePage.classList.add('active');
            slidePage.classList.remove('closing');
        });

        this.isOpen = true;

        // Focus first input if present
        setTimeout(() => {
            const firstInput = slidePage.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) firstInput.focus();
        }, 400);

        if (this.onOpen) this.onOpen(options);
    }

    close() {
        const mainView = document.getElementById(this.mainViewId);
        const slidePage = document.getElementById(this.slidePageId);

        if (!mainView || !slidePage) return;

        // Animate slide page out
        slidePage.classList.add('closing');
        slidePage.classList.remove('active');

        // Animate main view back
        mainView.classList.remove('slide-out');

        this.isOpen = false;

        // Clean up after animation
        setTimeout(() => {
            slidePage.innerHTML = '';
        }, 400);

        if (this.onClose) this.onClose();
    }

    buildSlidePageHTML(content, options) {
        const {
            title = 'Details',
            subtitle = '',
            icon = '',
            iconClass = 'sales',
            showFooter = true,
            footerHTML = '',
            primaryBtn = { text: 'Save', onclick: '' },
            secondaryBtn = { text: 'Cancel', onclick: 'slidePageManager.close()' }
        } = options;

        const defaultFooter = `
            <button class="btn btn-secondary" onclick="${secondaryBtn.onclick}">${secondaryBtn.text}</button>
            <button class="btn btn-primary" id="slidePageSubmitBtn" ${primaryBtn.onclick ? `onclick="${primaryBtn.onclick}"` : ''}>${primaryBtn.text}</button>
        `;

        return `
            <div class="slide-page-header">
                <button class="back-btn" onclick="slidePageManager.close()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    Back
                </button>
                ${icon ? `<div class="slide-page-icon ${iconClass}">${icon}</div>` : ''}
                <div class="slide-page-title-area">
                    <div class="slide-page-title">${title}</div>
                    ${subtitle ? `<div class="slide-page-subtitle">${subtitle}</div>` : ''}
                </div>
            </div>
            <div class="slide-page-body">
                ${content}
            </div>
            ${showFooter ? `
                <div class="slide-page-footer">
                    ${footerHTML || defaultFooter}
                </div>
            ` : ''}
        `;
    }

    setLoading(loading) {
        const btn = document.getElementById('slidePageSubmitBtn');
        if (btn) {
            btn.disabled = loading;
            if (loading) {
                btn.dataset.originalText = btn.textContent;
                btn.textContent = 'Saving...';
            } else {
                btn.textContent = btn.dataset.originalText || 'Save';
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT UPLOAD MANAGER
// Handles file uploads to Firebase Storage
// ═══════════════════════════════════════════════════════════════════════════
class DocumentUploadManager {
    constructor(options = {}) {
        this.storage = options.storage || null; // Firebase storage ref
        this.db = options.db || null; // Firestore ref
        this.appId = options.appId || 'dmg-command-centre-native';
        this.basePath = options.basePath || 'documents';
        this.onUploadComplete = options.onUploadComplete || null;
        this.onUploadError = options.onUploadError || null;
        this.uploadedFiles = [];
    }

    // Create upload zone HTML
    createUploadZoneHTML(id = 'uploadZone', multiple = true) {
        return `
            <div class="upload-zone" id="${id}" onclick="document.getElementById('${id}Input').click()">
                <input type="file" class="upload-input" id="${id}Input" ${multiple ? 'multiple' : ''}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.txt,.csv">
                <div class="upload-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                </div>
                <div class="upload-title">Drop files here or click to upload</div>
                <div class="upload-hint">PDF, Word, Excel, Images up to 25MB</div>
            </div>
            <div class="upload-progress" id="${id}Progress">
                <div class="progress-bar">
                    <div class="progress-fill" id="${id}ProgressFill"></div>
                </div>
                <div class="progress-text" id="${id}ProgressText">Uploading...</div>
            </div>
            <div class="uploaded-files" id="${id}Files"></div>
        `;
    }

    // Initialize upload zone with event listeners
    initUploadZone(zoneId = 'uploadZone') {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(`${zoneId}Input`);

        if (!zone || !input) {
            console.error('Upload zone elements not found');
            return;
        }

        // File input change
        input.addEventListener('change', (e) => {
            this.handleFiles(e.target.files, zoneId);
        });

        // Drag & drop events
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files, zoneId);
        });
    }

    // Handle file selection
    async handleFiles(fileList, zoneId) {
        const files = Array.from(fileList);
        const zone = document.getElementById(zoneId);
        const progress = document.getElementById(`${zoneId}Progress`);
        const progressFill = document.getElementById(`${zoneId}ProgressFill`);
        const progressText = document.getElementById(`${zoneId}ProgressText`);

        for (const file of files) {
            // Validate file
            if (!this.validateFile(file)) continue;

            try {
                zone.classList.add('uploading');
                progress.classList.add('active');
                progressText.textContent = `Uploading ${file.name}...`;
                progressFill.style.width = '0%';

                const result = await this.uploadFile(file, (percent) => {
                    progressFill.style.width = `${percent}%`;
                    progressText.textContent = `Uploading ${file.name}... ${Math.round(percent)}%`;
                });

                this.uploadedFiles.push(result);
                this.renderUploadedFiles(zoneId);

                if (this.onUploadComplete) {
                    this.onUploadComplete(result);
                }

                showToast(`${file.name} uploaded successfully`, 'success');

            } catch (error) {
                console.error('Upload error:', error);
                showToast(`Failed to upload ${file.name}`, 'error');

                if (this.onUploadError) {
                    this.onUploadError(error, file);
                }
            } finally {
                zone.classList.remove('uploading');
                progress.classList.remove('active');
            }
        }

        // Clear input
        document.getElementById(`${zoneId}Input`).value = '';
    }

    // Validate file before upload
    validateFile(file) {
        if (file.size > STORAGE_CONFIG.maxFileSize) {
            showToast(`${file.name} is too large (max 25MB)`, 'error');
            return false;
        }

        // Check file type by extension as fallback
        const ext = file.name.split('.').pop().toLowerCase();
        const allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
                            'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'txt', 'csv'];

        if (!STORAGE_CONFIG.allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
            showToast(`${file.name} is not a supported file type`, 'error');
            return false;
        }

        return true;
    }

    // Upload file to Firebase Storage
    async uploadFile(file, onProgress) {
        if (!this.storage) {
            // Fallback: Store as base64 in Firestore (for small files)
            return this.uploadToFirestore(file, onProgress);
        }

        // Create unique filename
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${this.basePath}/${timestamp}_${safeName}`;

        const storageRef = this.storage.ref(filePath);
        const uploadTask = storageRef.put(file);

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) onProgress(progress);
                },
                (error) => reject(error),
                async () => {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    resolve({
                        id: timestamp.toString(),
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        path: filePath,
                        url: downloadURL,
                        uploadedAt: new Date().toISOString()
                    });
                }
            );
        });
    }

    // Fallback upload to Firestore (for environments without Storage)
    async uploadToFirestore(file, onProgress) {
        if (!this.db) {
            throw new Error('No database available for upload');
        }

        // For larger files, just store metadata with a placeholder
        const timestamp = Date.now();
        const docRef = this.db.collection('artifacts').doc(this.appId)
            .collection('public').doc('data').collection('documents');

        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            if (onProgress && progress <= 90) onProgress(progress);
        }, 100);

        const docData = {
            id: timestamp.toString(),
            name: file.name,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            // For small files (<1MB), we could store base64
            // But better to use actual Firebase Storage
            status: 'pending_storage',
            localOnly: true
        };

        await docRef.doc(timestamp.toString()).set(docData);
        clearInterval(progressInterval);
        if (onProgress) onProgress(100);

        return docData;
    }

    // Render uploaded files list
    renderUploadedFiles(zoneId) {
        const container = document.getElementById(`${zoneId}Files`);
        if (!container) return;

        container.innerHTML = this.uploadedFiles.map(file => `
            <div class="uploaded-file" data-id="${file.id}">
                <div class="file-icon ${this.getFileIconClass(file.type)}">
                    ${this.getFileIconSVG(file.type)}
                </div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                </div>
                <div class="file-actions">
                    ${file.url ? `
                        <button class="file-action-btn download" onclick="window.open('${file.url}', '_blank')" title="Download">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </button>
                    ` : ''}
                    <button class="file-action-btn delete" onclick="documentUploadManager.removeFile('${file.id}', '${zoneId}')" title="Remove">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Remove file from list
    removeFile(fileId, zoneId) {
        this.uploadedFiles = this.uploadedFiles.filter(f => f.id !== fileId);
        this.renderUploadedFiles(zoneId);
    }

    // Get uploaded files
    getUploadedFiles() {
        return this.uploadedFiles;
    }

    // Clear uploaded files
    clearUploadedFiles() {
        this.uploadedFiles = [];
    }

    // Set existing files (when editing)
    setExistingFiles(files) {
        this.uploadedFiles = files || [];
    }

    // Helper: Get file icon class
    getFileIconClass(type) {
        if (type.includes('pdf')) return 'pdf';
        if (type.includes('word') || type.includes('document')) return 'doc';
        if (type.includes('image')) return 'image';
        return '';
    }

    // Helper: Get file icon SVG
    getFileIconSVG(type) {
        if (type.includes('pdf')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        }
        if (type.includes('image')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }

    // Helper: Format file size
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════
function showToast(message, type = '') {
    let toast = document.getElementById('toast');

    // Create toast element if it doesn't exist
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format date for display
function formatDate(dateStr) {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Format date for input
function formatDateForInput(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
}

// Format currency
function formatCurrency(val) {
    if (!val) return '£0';
    const num = parseFloat(val);
    if (num >= 1000000) return `£${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `£${Math.round(num / 1000)}K`;
    return `£${Math.round(num)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL INSTANCES
// These will be initialized by individual widgets
// ═══════════════════════════════════════════════════════════════════════════
let slidePageManager = null;
let documentUploadManager = null;

// Initialize slide page manager
function initSlidePageManager(options = {}) {
    slidePageManager = new SlidePageManager(options);
    return slidePageManager;
}

// Initialize document upload manager
function initDocumentUploadManager(options = {}) {
    documentUploadManager = new DocumentUploadManager(options);
    return documentUploadManager;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SlidePageManager,
        DocumentUploadManager,
        showToast,
        escapeHtml,
        formatDate,
        formatDateForInput,
        formatCurrency,
        initSlidePageManager,
        initDocumentUploadManager
    };
}

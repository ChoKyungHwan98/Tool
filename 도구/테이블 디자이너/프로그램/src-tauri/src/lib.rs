use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};
use tauri::Manager;

const OPENROUTER_CREDENTIAL_SERVICE: &str = "game-schema-workbench.openrouter";
const OPENROUTER_CREDENTIAL_ACCOUNT: &str = "default";

#[derive(Serialize)]
struct CredentialStatus {
    available: bool,
    stored: bool,
    message: String,
}

#[derive(Serialize)]
struct CredentialLoadResult {
    available: bool,
    stored: bool,
    message: String,
    #[serde(rename = "apiKey")]
    api_key: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkedProjectFile {
    path: String,
    last_known_modified_at: String,
    checksum: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectManifest {
    id: String,
    name: String,
    table_count: usize,
    relation_count: usize,
    row_count: usize,
    updated_at: String,
    location: String,
    recovery_count: usize,
    recovered: bool,
    checksum: String,
    revision: u64,
    linked_file: Option<LinkedProjectFile>,
    deleted_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSummary {
    id: String,
    name: String,
    table_count: usize,
    relation_count: usize,
    row_count: usize,
    updated_at: String,
    location: String,
    recovery_count: usize,
    recovered: bool,
    linked_file: Option<LinkedProjectFile>,
    deleted_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRecord {
    #[serde(flatten)]
    summary: ProjectSummary,
    checksum: String,
    serialized_document: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveProjectInput {
    project_id: String,
    name: String,
    serialized_document: String,
    revision: u64,
    table_count: usize,
    relation_count: usize,
    row_count: usize,
    create_recovery: bool,
    recovery_reason: String,
    serialized_recovery_document: Option<String>,
    linked_file: Option<LinkedProjectFile>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeRecoveryPoint {
    recovery_id: String,
    project_id: String,
    created_at: String,
    reason: String,
    checksum: String,
    serialized_document: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExternalProjectFileResult {
    serialized_document: String,
    linked_file: LinkedProjectFile,
}

fn repository_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("project-library"))
        .map_err(|error| error.to_string())
}

fn project_files_directory_from_executable(executable: &Path) -> Option<PathBuf> {
    executable
        .parent()
        .map(|directory| directory.join("프로젝트"))
}

fn shared_project_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let portable = std::env::current_exe()
        .ok()
        .and_then(|executable| project_files_directory_from_executable(&executable));
    let directory = match portable {
        Some(directory) if fs::create_dir_all(&directory).is_ok() => directory,
        _ => app
            .path()
            .document_dir()
            .map_err(|error| error.to_string())?
            .join("테이블 디자이너 프로젝트"),
    };
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

#[tauri::command]
fn project_files_directory(app: tauri::AppHandle) -> Result<String, String> {
    Ok(shared_project_directory(&app)?
        .to_string_lossy()
        .to_string())
}

fn safe_project_file_name(name: &str) -> String {
    let value = name
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => character,
        })
        .collect::<String>()
        .trim()
        .trim_end_matches(['.', ' '])
        .to_string();
    if value.is_empty() {
        "프로젝트".to_string()
    } else {
        value
    }
}

fn shared_document_identity(
    serialized: &str,
) -> Result<(String, String, u64, usize, usize, usize), String> {
    let document: serde_json::Value = serde_json::from_str(serialized)
        .map_err(|error| format!("프로젝트 JSON 검증 실패: {error}"))?;
    let schema = document
        .get("schema")
        .and_then(|value| value.as_object())
        .ok_or_else(|| "프로젝트에 schema가 없습니다.".to_string())?;
    let project_id = schema
        .get("projectId")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    if project_id.is_empty() {
        return Err("프로젝트 ID가 없습니다.".to_string());
    }
    let name = schema
        .get("name")
        .and_then(|value| value.as_str())
        .unwrap_or("프로젝트")
        .to_string();
    let revision = document
        .get("revision")
        .and_then(|value| value.as_u64())
        .unwrap_or(0);
    let table_count = schema
        .get("tables")
        .and_then(|value| value.as_array())
        .map_or(0, Vec::len);
    let relation_count = schema
        .get("relations")
        .and_then(|value| value.as_array())
        .map_or(0, Vec::len);
    let row_count = document
        .get("rowsByTable")
        .and_then(|value| value.as_object())
        .map(|tables| {
            tables
                .values()
                .filter_map(|rows| rows.as_array())
                .map(Vec::len)
                .sum()
        })
        .unwrap_or(0);
    Ok((
        project_id,
        name,
        revision,
        table_count,
        relation_count,
        row_count,
    ))
}

fn find_shared_project_file(directory: &Path, project_id: &str) -> Result<Option<PathBuf>, String> {
    for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
            || entry.path().extension().and_then(|value| value.to_str()) != Some("gsw")
        {
            continue;
        }
        let text = match fs::read_to_string(entry.path()) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if shared_document_identity(&text)
            .map(|identity| identity.0 == project_id)
            .unwrap_or(false)
        {
            return Ok(Some(entry.path()));
        }
    }
    Ok(None)
}

fn cache_shared_project(root: &Path, file: &Path, serialized: &str) -> Result<String, String> {
    let (project_id, name, revision, table_count, relation_count, row_count) =
        shared_document_identity(serialized)?;
    let directory = project_dir(root, &project_id);
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    atomic_write(&directory.join("current.gsw"), serialized)?;
    let checksum = sha256_text(serialized);
    let modified = fs::metadata(file)
        .and_then(|metadata| metadata.modified())
        .map(DateTime::<Utc>::from)
        .unwrap_or_else(|_| Utc::now())
        .to_rfc3339();
    let manifest = ProjectManifest {
        id: project_id.clone(),
        name,
        table_count,
        relation_count,
        row_count,
        updated_at: modified.clone(),
        location: file.to_string_lossy().to_string(),
        recovery_count: prune_recovery(&directory)?,
        recovered: false,
        checksum: checksum.clone(),
        revision,
        linked_file: Some(LinkedProjectFile {
            path: file.to_string_lossy().to_string(),
            last_known_modified_at: modified,
            checksum,
        }),
        deleted_at: None,
    };
    write_manifest(&directory, &manifest)?;
    Ok(project_id)
}

fn synchronize_shared_projects(app: &tauri::AppHandle, root: &Path) -> Result<(), String> {
    let shared = shared_project_directory(app)?;
    let mut central_ids = std::collections::HashSet::new();
    for entry in fs::read_dir(&shared).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
            || entry.path().extension().and_then(|value| value.to_str()) != Some("gsw")
        {
            continue;
        }
        let serialized = match fs::read_to_string(entry.path()) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if let Ok(project_id) = cache_shared_project(root, &entry.path(), &serialized) {
            central_ids.insert(project_id);
        }
    }
    let projects = root.join("projects");
    for entry in fs::read_dir(&projects).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            continue;
        }
        let project_id = match read_manifest(&entry.path()) {
            Ok(value) => value.id,
            Err(_) => continue,
        };
        if !central_ids.contains(&project_id) {
            let target = root.join("trash").join(entry.file_name());
            if target.exists() {
                fs::remove_dir_all(&target).map_err(|error| error.to_string())?;
            }
            fs::rename(entry.path(), target).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn project_dir(root: &Path, project_id: &str) -> PathBuf {
    root.join("projects").join(storage_key(project_id))
}

fn storage_key(project_id: &str) -> String {
    if !project_id.is_empty()
        && project_id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
    {
        return project_id.to_string();
    }
    format!("project-{}", sha256_text(project_id))
}

fn sha256_text(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}

fn atomic_write(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "저장 경로가 올바르지 않습니다.".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temp = path.with_extension("tmp");
    let mut file = File::create(&temp).map_err(|error| error.to_string())?;
    file.write_all(contents.as_bytes())
        .map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    drop(file);
    serde_json::from_str::<serde_json::Value>(contents)
        .map_err(|error| format!("저장 검증 실패: {error}"))?;
    let backup = path.with_extension("bak");
    if backup.exists() {
        fs::remove_file(&backup).map_err(|error| error.to_string())?;
    }
    if path.exists() {
        fs::rename(path, &backup).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&temp, path) {
        if backup.exists() {
            let _ = fs::rename(&backup, path);
        }
        return Err(error.to_string());
    }
    OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .and_then(|file| file.sync_all())
        .map_err(|error| error.to_string())?;
    if backup.exists() {
        fs::remove_file(backup).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn read_manifest(directory: &Path) -> Result<ProjectManifest, String> {
    let text =
        fs::read_to_string(directory.join("manifest.json")).map_err(|error| error.to_string())?;
    serde_json::from_str(&text).map_err(|error| error.to_string())
}

fn write_manifest(directory: &Path, manifest: &ProjectManifest) -> Result<(), String> {
    let text = serde_json::to_string_pretty(manifest).map_err(|error| error.to_string())?;
    atomic_write(&directory.join("manifest.json"), &text)
}

fn manifest_summary(manifest: &ProjectManifest) -> ProjectSummary {
    ProjectSummary {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        table_count: manifest.table_count,
        relation_count: manifest.relation_count,
        row_count: manifest.row_count,
        updated_at: manifest.updated_at.clone(),
        location: manifest.location.clone(),
        recovery_count: manifest.recovery_count,
        recovered: manifest.recovered,
        linked_file: manifest.linked_file.clone(),
        deleted_at: manifest.deleted_at.clone(),
    }
}

fn record_from_directory(directory: &Path) -> Result<ProjectRecord, String> {
    let manifest = read_manifest(directory)?;
    let serialized_document =
        fs::read_to_string(directory.join("current.gsw")).map_err(|error| error.to_string())?;
    let checksum = sha256_text(&serialized_document);
    if checksum != manifest.checksum {
        return Err("현재 프로젝트 파일의 체크섬이 일치하지 않습니다.".to_string());
    }
    serde_json::from_str::<serde_json::Value>(&serialized_document)
        .map_err(|error| error.to_string())?;
    Ok(ProjectRecord {
        summary: manifest_summary(&manifest),
        checksum,
        serialized_document,
    })
}

fn list_manifests(parent: &Path) -> Result<Vec<ProjectSummary>, String> {
    if !parent.exists() {
        return Ok(Vec::new());
    }
    let mut values = Vec::new();
    for entry in fs::read_dir(parent).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            if let Ok(manifest) = read_manifest(&entry.path()) {
                values.push(manifest_summary(&manifest));
            }
        }
    }
    values.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(values)
}

fn prune_recovery(directory: &Path) -> Result<usize, String> {
    let recovery_dir = directory.join("recovery");
    if !recovery_dir.exists() {
        return Ok(0);
    }
    let cutoff = Utc::now() - Duration::days(30);
    let mut entries = fs::read_dir(&recovery_dir)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.file_name()));
    for (index, entry) in entries.iter().enumerate() {
        let remove_by_age = entry
            .metadata()
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .map(DateTime::<Utc>::from)
            .map(|date| date < cutoff)
            .unwrap_or(false);
        if index >= 30 || remove_by_age {
            let _ = fs::remove_file(entry.path());
        }
    }
    fs::read_dir(&recovery_dir)
        .map_err(|error| error.to_string())?
        .try_fold(0usize, |count, entry| {
            entry.map(|_| count + 1).map_err(|error| error.to_string())
        })
}

fn prune_trash(root: &Path) -> Result<(), String> {
    let trash = root.join("trash");
    if !trash.exists() {
        return Ok(());
    }
    let cutoff = Utc::now() - Duration::days(30);
    for entry in fs::read_dir(&trash).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            continue;
        }
        let expired = read_manifest(&entry.path())
            .ok()
            .and_then(|manifest| manifest.deleted_at)
            .and_then(|value| DateTime::parse_from_rfc3339(&value).ok())
            .map(|date| date.with_timezone(&Utc) < cutoff)
            .unwrap_or(false);
        if expired {
            fs::remove_dir_all(entry.path()).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn initialize_project_repository(app: tauri::AppHandle) -> Result<(), String> {
    let root = repository_root(&app)?;
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("trash")).map_err(|error| error.to_string())?;
    prune_trash(&root)?;
    synchronize_shared_projects(&app, &root)?;
    Ok(())
}

#[tauri::command]
fn list_project_records(app: tauri::AppHandle) -> Result<Vec<ProjectSummary>, String> {
    list_manifests(&repository_root(&app)?.join("projects"))
}

#[tauri::command]
fn load_project_record(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<Option<ProjectRecord>, String> {
    let directory = project_dir(&repository_root(&app)?, &project_id);
    if !directory.exists() {
        return Ok(None);
    }
    match record_from_directory(&directory) {
        Ok(record) => Ok(Some(record)),
        Err(_) => {
            let mut points = list_project_recovery_points(app.clone(), project_id.clone())?;
            let latest = points
                .drain(..)
                .next()
                .ok_or_else(|| "현재 파일이 손상되었고 복구본이 없습니다.".to_string())?;
            atomic_write(&directory.join("current.gsw"), &latest.serialized_document)?;
            let mut manifest = read_manifest(&directory)?;
            manifest.checksum = latest.checksum;
            manifest.recovered = true;
            manifest.updated_at = Utc::now().to_rfc3339();
            write_manifest(&directory, &manifest)?;
            record_from_directory(&directory).map(Some)
        }
    }
}

#[tauri::command]
fn save_project_record(
    app: tauri::AppHandle,
    mut input: SaveProjectInput,
) -> Result<ProjectRecord, String> {
    serde_json::from_str::<serde_json::Value>(&input.serialized_document)
        .map_err(|error| format!("프로젝트 JSON 검증 실패: {error}"))?;
    let shared = shared_project_directory(&app)?;
    let linked_path = match find_shared_project_file(&shared, &input.project_id)? {
        Some(path) => path,
        None => {
            let base = safe_project_file_name(&input.name);
            let candidate = shared.join(format!("{base}.gsw"));
            if !candidate.exists() {
                candidate
            } else {
                shared.join(format!("{base}-{}.gsw", storage_key(&input.project_id)))
            }
        }
    };
    let existing_checksum = if linked_path.exists() {
        fs::read_to_string(&linked_path)
            .ok()
            .map(|value| sha256_text(&value))
            .unwrap_or_default()
    } else {
        String::new()
    };
    input.linked_file = Some(LinkedProjectFile {
        path: linked_path.to_string_lossy().to_string(),
        last_known_modified_at: Utc::now().to_rfc3339(),
        checksum: existing_checksum,
    });
    let root = repository_root(&app)?;
    let directory = project_dir(&root, &input.project_id);
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let checksum = sha256_text(&input.serialized_document);

    if let Some(linked) = &mut input.linked_file {
        let linked_path = Path::new(&linked.path);
        if linked_path.exists() {
            let current = fs::read_to_string(linked_path).map_err(|error| error.to_string())?;
            let current_checksum = sha256_text(&current);
            if !linked.checksum.is_empty() && current_checksum != linked.checksum {
                return Err("EXTERNAL_CONFLICT: 연결된 .gsw 파일이 다른 프로그램에서 변경되었습니다. 다시 불러오거나 복사본으로 저장하세요.".to_string());
            }
        }
        atomic_write(linked_path, &input.serialized_document)?;
        linked.checksum = checksum.clone();
        linked.last_known_modified_at = Utc::now().to_rfc3339();
    }

    if input.create_recovery {
        let previous = if let Some(recovery) = &input.serialized_recovery_document {
            recovery.clone()
        } else if directory.join("current.gsw").exists() {
            fs::read_to_string(directory.join("current.gsw")).map_err(|error| error.to_string())?
        } else {
            input.serialized_document.clone()
        };
        serde_json::from_str::<serde_json::Value>(&previous)
            .map_err(|error| format!("복구본 JSON 검증 실패: {error}"))?;
        let stamp = Utc::now().format("%Y%m%dT%H%M%S%.3fZ");
        atomic_write(
            &directory
                .join("recovery")
                .join(format!("{stamp}_{}.gsw", input.recovery_reason)),
            &previous,
        )?;
    }

    atomic_write(&directory.join("current.gsw"), &input.serialized_document)?;
    let written =
        fs::read_to_string(directory.join("current.gsw")).map_err(|error| error.to_string())?;
    if sha256_text(&written) != checksum {
        return Err("저장 후 체크섬 검증에 실패했습니다.".to_string());
    }

    let recovery_count = prune_recovery(&directory)?;
    let now = Utc::now().to_rfc3339();
    let manifest = ProjectManifest {
        id: input.project_id,
        name: input.name,
        table_count: input.table_count,
        relation_count: input.relation_count,
        row_count: input.row_count,
        updated_at: now,
        location: input
            .linked_file
            .as_ref()
            .map(|file| file.path.clone())
            .unwrap_or_else(|| directory.join("current.gsw").to_string_lossy().to_string()),
        recovery_count,
        recovered: false,
        checksum,
        revision: input.revision,
        linked_file: input.linked_file,
        deleted_at: None,
    };
    write_manifest(&directory, &manifest)?;
    record_from_directory(&directory)
}

#[tauri::command]
fn read_external_project_file(path: String) -> Result<ExternalProjectFileResult, String> {
    let serialized_document = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str::<serde_json::Value>(&serialized_document)
        .map_err(|error| format!("프로젝트 파일 검증 실패: {error}"))?;
    let checksum = sha256_text(&serialized_document);
    let modified = fs::metadata(&path)
        .and_then(|metadata| metadata.modified())
        .map(DateTime::<Utc>::from)
        .unwrap_or_else(|_| Utc::now());
    Ok(ExternalProjectFileResult {
        serialized_document,
        linked_file: LinkedProjectFile {
            path,
            last_known_modified_at: modified.to_rfc3339(),
            checksum,
        },
    })
}

#[tauri::command]
fn write_external_project_file(
    path: String,
    serialized_document: String,
    expected_checksum: Option<String>,
) -> Result<LinkedProjectFile, String> {
    let file_path = Path::new(&path);
    if file_path.exists() {
        let current = fs::read_to_string(file_path).map_err(|error| error.to_string())?;
        if let Some(expected) = expected_checksum {
            if !expected.is_empty() && sha256_text(&current) != expected {
                return Err(
                    "EXTERNAL_CONFLICT: 대상 파일이 다른 프로그램에서 변경되었습니다.".to_string(),
                );
            }
        }
    }
    serde_json::from_str::<serde_json::Value>(&serialized_document)
        .map_err(|error| format!("프로젝트 파일 검증 실패: {error}"))?;
    atomic_write(file_path, &serialized_document)?;
    Ok(LinkedProjectFile {
        path,
        last_known_modified_at: Utc::now().to_rfc3339(),
        checksum: sha256_text(&serialized_document),
    })
}

#[tauri::command]
fn trash_project_record(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
    let root = repository_root(&app)?;
    let source = project_dir(&root, &project_id);
    if !source.exists() {
        return Ok(());
    }
    let target = root.join("trash").join(storage_key(&project_id));
    if target.exists() {
        fs::remove_dir_all(&target).map_err(|error| error.to_string())?;
    }
    let mut manifest = read_manifest(&source)?;
    manifest.deleted_at = Some(Utc::now().to_rfc3339());
    write_manifest(&source, &manifest)?;
    fs::rename(source, target).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_trashed_project_records(app: tauri::AppHandle) -> Result<Vec<ProjectSummary>, String> {
    let root = repository_root(&app)?;
    prune_trash(&root)?;
    list_manifests(&root.join("trash"))
}

#[tauri::command]
fn restore_trashed_project_record(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<Option<ProjectRecord>, String> {
    let root = repository_root(&app)?;
    let source = root.join("trash").join(storage_key(&project_id));
    if !source.exists() {
        return Ok(None);
    }
    let target = project_dir(&root, &project_id);
    if target.exists() {
        return Err("같은 ID의 프로젝트가 이미 보관함에 있습니다.".to_string());
    }
    let mut manifest = read_manifest(&source)?;
    manifest.deleted_at = None;
    manifest.updated_at = Utc::now().to_rfc3339();
    write_manifest(&source, &manifest)?;
    fs::rename(source, &target).map_err(|error| error.to_string())?;
    record_from_directory(&target).map(Some)
}

#[tauri::command]
fn list_project_recovery_points(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<Vec<NativeRecoveryPoint>, String> {
    let directory = project_dir(&repository_root(&app)?, &project_id).join("recovery");
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut points = Vec::new();
    for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let serialized_document =
            fs::read_to_string(entry.path()).map_err(|error| error.to_string())?;
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        let created_at: DateTime<Utc> = metadata
            .modified()
            .map(DateTime::from)
            .unwrap_or_else(|_| Utc::now());
        let name = entry.file_name().to_string_lossy().to_string();
        let reason = name
            .trim_end_matches(".gsw")
            .split('_')
            .last()
            .unwrap_or("checkpoint")
            .to_string();
        points.push(NativeRecoveryPoint {
            recovery_id: name,
            project_id: project_id.clone(),
            created_at: created_at.to_rfc3339(),
            reason,
            checksum: sha256_text(&serialized_document),
            serialized_document,
        });
    }
    points.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(points)
}

#[tauri::command]
fn restore_project_recovery_point(
    app: tauri::AppHandle,
    project_id: String,
    recovery_id: String,
) -> Result<ProjectRecord, String> {
    let directory = project_dir(&repository_root(&app)?, &project_id);
    let recovery_path = directory.join("recovery").join(recovery_id);
    let document = fs::read_to_string(recovery_path).map_err(|error| error.to_string())?;
    atomic_write(&directory.join("current.gsw"), &document)?;
    let mut manifest = read_manifest(&directory)?;
    manifest.checksum = sha256_text(&document);
    manifest.recovered = true;
    manifest.updated_at = Utc::now().to_rfc3339();
    write_manifest(&directory, &manifest)?;
    record_from_directory(&directory)
}

fn credential_error_message(error: impl std::fmt::Display) -> String {
    let text = error.to_string();

    if text.trim().is_empty() {
        "Credential store operation failed.".to_string()
    } else {
        text
    }
}

fn openrouter_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(OPENROUTER_CREDENTIAL_SERVICE, OPENROUTER_CREDENTIAL_ACCOUNT)
        .map_err(credential_error_message)
}

#[tauri::command]
fn save_openrouter_api_key(api_key: String) -> Result<CredentialStatus, String> {
    let trimmed = api_key.trim();

    if trimmed.is_empty() {
        return Err("API key is empty.".to_string());
    }

    let entry = openrouter_entry()?;
    entry
        .set_password(trimmed)
        .map_err(credential_error_message)?;

    Ok(CredentialStatus {
        available: true,
        stored: true,
        message: "OpenRouter API key saved to the OS credential store.".to_string(),
    })
}

#[tauri::command]
fn get_openrouter_credential_status() -> Result<CredentialStatus, String> {
    let entry = openrouter_entry()?;

    match entry.get_password() {
        Ok(password) => Ok(CredentialStatus {
            available: true,
            stored: !password.trim().is_empty(),
            message: "OS credential store is available.".to_string(),
        }),
        Err(keyring::Error::NoEntry) => Ok(CredentialStatus {
            available: true,
            stored: false,
            message: "No OpenRouter API key is stored.".to_string(),
        }),
        Err(error) => Err(credential_error_message(error)),
    }
}

#[tauri::command]
fn load_openrouter_api_key() -> Result<CredentialLoadResult, String> {
    let entry = openrouter_entry()?;

    match entry.get_password() {
        Ok(password) if !password.trim().is_empty() => Ok(CredentialLoadResult {
            available: true,
            stored: true,
            message: "OpenRouter API key loaded from the OS credential store.".to_string(),
            api_key: Some(password),
        }),
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(CredentialLoadResult {
            available: true,
            stored: false,
            message: "No OpenRouter API key is stored.".to_string(),
            api_key: None,
        }),
        Err(error) => Err(credential_error_message(error)),
    }
}

#[tauri::command]
fn delete_openrouter_api_key() -> Result<CredentialStatus, String> {
    let entry = openrouter_entry()?;

    match entry.delete_password() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(CredentialStatus {
            available: true,
            stored: false,
            message: "OpenRouter API key removed from the OS credential store.".to_string(),
        }),
        Err(error) => Err(credential_error_message(error)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_openrouter_api_key,
            get_openrouter_credential_status,
            load_openrouter_api_key,
            delete_openrouter_api_key,
            initialize_project_repository,
            list_project_records,
            load_project_record,
            save_project_record,
            trash_project_record,
            list_trashed_project_records,
            restore_trashed_project_record,
            list_project_recovery_points,
            restore_project_recovery_point,
            read_external_project_file,
            write_external_project_file,
            project_files_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_directory(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("gsw-{label}-{}-{nonce}", std::process::id()))
    }

    #[test]
    fn storage_key_keeps_normal_ids_and_hashes_path_like_ids() {
        assert_eq!(storage_key("project_123-abc"), "project_123-abc");
        let unsafe_key = storage_key("../../outside");
        assert!(unsafe_key.starts_with("project-"));
        assert!(!unsafe_key.contains('/'));
        assert!(!unsafe_key.contains(".."));
    }

    #[test]
    fn portable_project_files_live_next_to_the_executable() {
        let executable = Path::new(r"C:\Tools\테이블 디자이너\테이블 디자이너.exe");
        assert_eq!(
            project_files_directory_from_executable(executable),
            Some(PathBuf::from(r"C:\Tools\테이블 디자이너\프로젝트"))
        );
    }

    #[test]
    fn atomic_write_keeps_the_last_valid_document_when_validation_fails() {
        let root = test_directory("atomic-write");
        let path = root.join("current.gsw");
        atomic_write(&path, r#"{"revision":1}"#).expect("first write should succeed");

        assert!(atomic_write(&path, "not-json").is_err());
        assert_eq!(
            fs::read_to_string(&path).expect("current file should remain"),
            r#"{"revision":1}"#
        );

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn recovery_pruning_keeps_at_most_thirty_points() {
        let root = test_directory("recovery-prune");
        let recovery = root.join("recovery");
        fs::create_dir_all(&recovery).expect("recovery directory should be created");
        for index in 0..35 {
            fs::write(recovery.join(format!("{index:02}.json")), "{}")
                .expect("recovery fixture should be written");
        }

        assert_eq!(prune_recovery(&root).expect("prune should succeed"), 30);
        assert_eq!(
            fs::read_dir(&recovery)
                .expect("recovery directory should exist")
                .count(),
            30
        );

        fs::remove_dir_all(root).expect("test directory should be removable");
    }
}

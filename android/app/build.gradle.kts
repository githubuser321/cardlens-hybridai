plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// google-services.json is NOT committed (see .gitignore). Apply the plugin only when the
// file is present so CI and fresh clones still build; the app shows "Firebase not configured".
val hasGoogleServicesJson = listOf(
    "google-services.json",
    "src/debug/google-services.json",
    "src/release/google-services.json",
).any { file(it).exists() }
if (hasGoogleServicesJson) {
    apply(plugin = libs.plugins.google.services.get().pluginId)
} else {
    logger.lifecycle("CardLens: app/google-services.json not found - building without Firebase config.")
}

android {
    namespace = "io.cardlens.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.cardlens.app"
        minSdk = 26 // required by firebase-ai-ondevice (ML Kit Prompt API)
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0-m0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.all {
            // Single source of truth: repo-root shared/schema, one directory above this Gradle project.
            it.systemProperty(
                "cardlens.schemaDir",
                rootProject.file("../shared/schema").canonicalFile.absolutePath,
            )
        }
    }
}

dependencies {
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.common)
    implementation(libs.firebase.ai)          // pinned 18.2.0 (see libs.versions.toml)
    implementation(libs.firebase.ai.ondevice) // 16.0.0-beta08 (not in the BoM yet)
    implementation(libs.firebase.appcheck)
    // Production attestation only in release; the debug provider never ships in release.
    releaseImplementation(libs.firebase.appcheck.playintegrity)
    debugImplementation(libs.firebase.appcheck.debug)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}

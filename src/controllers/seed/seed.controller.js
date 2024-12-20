import Cropvariety from "../../models/crop/cropVariety.model.js";
import Seed from "../../models/seed/seed.model.js";
import SeedImage from "../../models/seed/seedImage.model.js";
import { bodyReqFields, queryReqFields } from "../../utils/requiredFields.js";
import { catchError, catchWithSequelizeFrontError, conflictError, frontError, notFound, successOk, successOkWithData, validationError } from "../../utils/responses.js";
import { convertToLowercase, getRelativePath } from "../../utils/utils.js";


// ================================================================
//                          CONTROLLERS
// ================================================================

export async function addSeed(req, res) {
    try {
        const reqFields = ["seed_variety_name", "company_fk", "crop_category", "crop", "seed_weight", "package_weight", "package_type", "germination_percentage", "maturity_percentage", "min_harvesting_days", "max_harvesting_days", "suitable_region"];
        const bodyFieldsReq = bodyReqFields(req, res, reqFields);
        if (bodyFieldsReq.error) return bodyFieldsReq.response;

        if (!req.files?.images?.length) return frontError(res, "Atleast one image is required.", "images")
        let requiredData = convertToLowercase(req.body);

        const { min_harvesting_days, max_harvesting_days } = requiredData;
        if (parseInt(min_harvesting_days) > parseInt(max_harvesting_days)) return validationError(res, "Min harvesting days must be less than equal to max harvesting days");

        // DUPLICATION TEST
        const { seed_variety_name, company_fk, crop_category, crop, package_weight, package_type } = requiredData;
        const seedExist = await Seed.findOne({ where: { seed_variety_name, company_fk, crop_category, crop, package_weight, package_type } })
        if (seedExist) return conflictError(res, "Seeds already added in global list")

        // DOES SEED EXIST IN SIMULATOR CROP VARIETY
        const seedExistInSimulator = await Cropvariety.findOne({ where: { variety_eng: seed_variety_name }, attributes: ["variety_eng"] });
        if (seedExistInSimulator) {
            requiredData.in_simulator = true
            await Cropvariety.update({ in_farmacie: true }, { where: { variety_eng: seed_variety_name } })
        };

        // ADDING SEED
        const seed = await Seed.create(requiredData);

        // ADDING SEED IMAGES
        const seedImages = req.files.images.map(image => ({ image_url: getRelativePath(image.path), seed_fk: seed.uuid }))
        await SeedImage.bulkCreate(seedImages);
        return successOk(res, "Seed added successfully");
    } catch (error) {
        console.log("error: -------------_: ", error)
        return catchWithSequelizeFrontError(res, error);
    }
}


// ========================== getSingleSeed ================================


export async function getSingleSeed(req, res) {
    try {
        const queryFieldsReq = queryReqFields(req, res, ["uuid"]);
        if (queryFieldsReq.error) return queryFieldsReq.response;
        const { uuid } = req.query

        const seed = await Seed.findByPk(uuid, {
            include: [
                {
                    required: false,
                    model: SeedImage,
                    as: 'seed_image',
                    attributes: ['image_url', 'uuid']
                }
            ],
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            where: { uuid }
        });
        if (!seed) return notFound(res, "Seed not found", "uuid");
        return successOkWithData(res, "Seed fetched successfully", seed);
    } catch (error) {
        return catchError(res, error);
    }
}



// ========================== getSeeds ================================


export async function getSeeds(req, res) {
    try {
        const products = await Seed.findAll({
            attributes: ['uuid', 'seed_variety_name', 'company_fk', 'crop_category', 'crop', "in_simulator", "trial_count"]
        });
        return successOkWithData(res, "Seeds fetched successfully", products);
    } catch (error) {
        return catchError(res, error);
    }
}


// ========================== deleteSeed ================================


export async function deleteSeed(req, res) {
    try {
        const queryFieldsReq = queryReqFields(req, res, ["uuid"])
        if (queryFieldsReq.error) return queryFieldsReq.response

        const { uuid } = req.query;
        await Seed.destroy({ where: { uuid } })
        return successOk(res, "Seed delete successfully")

    } catch (error) {
        return catchError(res, error)
    }
}

// ========================== deleteSeedImg ================================


export async function deleteSeedImg(req, res) {
    try {
        const queryFieldsReq = queryReqFields(req, res, ["imgUid"])
        if (queryFieldsReq.error) return queryFieldsReq.response

        const { imgUid } = req.query;
        await SeedImage.destroy({ where: { uuid: imgUid } })
        return successOk(res, "Seed images delete successfully")

    } catch (error) {
        return catchError(res, error)
    }
}


// ========================== updateSeed ================================


export async function updateSeed(req, res) {
    try {
        const queryFieldsReq = queryReqFields(req, res, ["uuid"])
        if (queryFieldsReq.error) return queryFieldsReq.response

        const { uuid } = req.query;
        const seed = await Seed.findOne({ where: { uuid }, attributes: ["min_harvesting_days", "max_harvesting_days"] });
        if (!seed) return notFound(res, "Seed not found");

        if (req.files?.images?.length) {
            const seedImages = req.files.images.map(image => ({ image_url: getRelativePath(image.path), seed_fk: uuid }))
            await SeedImage.bulkCreate(seedImages);
        }

        let requiredData = convertToLowercase(req.body);
        // Harvesting days validations
        let { min_harvesting_days, max_harvesting_days } = requiredData;
        min_harvesting_days = parseInt(min_harvesting_days);
        max_harvesting_days = parseInt(max_harvesting_days);
        if (min_harvesting_days && max_harvesting_days && min_harvesting_days > max_harvesting_days) return validationError(res, "Min harvesting days must be less than max harvesting days");
        if (min_harvesting_days && seed.max_harvesting_days < min_harvesting_days) return validationError(res, "Min harvesting days must be less than max harvesting days");
        if (max_harvesting_days && seed.min_harvesting_days > max_harvesting_days) return validationError(res, "Max harvesting days must be greater than min harvesting days");


        // ADDING SEED
        await Seed.update(requiredData, { where: { uuid } });

        return successOk(res, "Seed updated successfully");
    } catch (error) {
        console.log("error: -------------_: ", error)
        return catchWithSequelizeFrontError(res, error);
    }
}

// ========================== seedStats ================================
export async function seedStats(req, res) {
    try {
        const seedCount = await Seed.count();
        const seedInSimulatorCount = await Seed.count({ where: { in_simulator: true } });
        return successOkWithData(res, "Seeds fetched successfully", { seedCount, seedInSimulatorCount });
    } catch (error) {
        return catchError(res, error);
    }
}

// ================= alreadyInSimulator =======================

export async function alreadyInSimulator(req, res) {
    try {
        const reqFields = ["uuid"]
        const queryField = queryReqFields(req, res, reqFields)
        if (queryField.error) return queryField.error;

        const { uuid } = req.query;
        const seed = await Seed.findByPk(uuid)

        if (!seed) return notFound(res, "seed not found.")
        if (seed.in_simulator) return successOk(res, "Seed in simulator status already set.")
        seed.in_simulator = true;
        await seed.save();
        return successOk(res, "seed in simulator status updated successfully.")
    } catch (error) {
        return catchError(res, error)
    }
}